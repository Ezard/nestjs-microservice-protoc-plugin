import {
  DescriptorProto,
  EnumDescriptorProto,
  EnumValueDescriptorProto,
  FieldDescriptorProto,
  FieldDescriptorProto_Label,
  FieldDescriptorProto_Type,
  FileDescriptorProto,
} from '@protobuf-ts/plugin-framework';
import { rmSync } from 'fs';
import { join } from 'path';
import { code } from 'ts-poet';
import { BASE_TEST_DIR, trimPadding } from '../test/utils';
import { Service } from './core';
import { generateTypeMap, generateTypesContent, getImpFromTypeName, TypeMap } from './types';

describe('types', () => {
  const rootTestDir = join(BASE_TEST_DIR, 'types');

  describe('generateTypeMap', () => {
    it('should add types to the type map when no package name is specified', () => {
      const typeMap = generateTypeMap([
        FileDescriptorProto.create({
          name: 'foos.proto',
          messageType: [DescriptorProto.create({ name: 'Bar' })],
        }),
      ]);

      expect(typeMap.get('.Bar')).toBeDefined();
      expect(typeMap.get('.Bar')?.type).toEqual('Bar');
      expect(typeMap.get('.Bar')?.relativePath).toEqual('foos.types');
    });

    it('should add types to the type map when a single level package name is specified', () => {
      const typeMap = generateTypeMap([
        FileDescriptorProto.create({
          name: 'foos.proto',
          package: 'foo',
          messageType: [DescriptorProto.create({ name: 'Bar' })],
        }),
      ]);

      expect(typeMap.get('.foo.Bar')).toBeDefined();
      expect(typeMap.get('.foo.Bar')?.type).toEqual('Bar');
      expect(typeMap.get('.foo.Bar')?.relativePath).toEqual('foo/foos.types');
    });

    it('should add types to the type map when a multi-level package name is specified', () => {
      const typeMap = generateTypeMap([
        FileDescriptorProto.create({
          name: 'foos.proto',
          package: 'foo.baz',
          messageType: [DescriptorProto.create({ name: 'Bar' })],
        }),
      ]);

      expect(typeMap.get('.foo.baz.Bar')).toBeDefined();
      expect(typeMap.get('.foo.baz.Bar')?.type).toEqual('Bar');
      expect(typeMap.get('.foo.baz.Bar')?.relativePath).toEqual('foo/baz/foos.types');
    });

    it('should add enum types to the type map', () => {
      const enumName = 'Foo';
      const typeMap = generateTypeMap([
        FileDescriptorProto.create({
          name: 'foos.proto',
          enumType: [
            EnumDescriptorProto.create({
              name: enumName,
            }),
          ],
        }),
      ]);

      expect(typeMap.get('.Foo')).toBeDefined();
      expect(typeMap.get('.Foo')?.type).toEqual('Foo');
      expect(typeMap.get('.Foo')?.relativePath).toEqual('foos.types');
    });
  });

  describe('getImpFromTypeName', () => {
    it('should return a code block containing the requested type if it was found', async () => {
      const typeName = '.Foo';
      const typeMap: TypeMap = new Map<string, { type: string; relativePath: string }>([
        [typeName, { type: 'Foo', relativePath: 'foo.types' }],
      ]);

      const imp = getImpFromTypeName(typeMap, typeName);
      const result = await code`const bar: ${imp}`.toStringWithImports();

      const expected = trimPadding(`
        import { Foo } from './foo.types';

        const bar: Foo;
      `).trim();

      expect(result.trim()).toEqual(expected);
    });

    it('should throw an error if the requested type was not found', async () => {
      const typeMap: TypeMap = new Map<string, { type: string; relativePath: string }>([
        ['.Foo', { type: 'Foo', relativePath: 'foo.types' }],
      ]);

      let error: Error | null = null;
      try {
        const imp = getImpFromTypeName(typeMap, '.Bar');
        await code`const bar: ${imp}`.toStringWithImports();
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error?.message).toEqual("Type '.Bar' was not found in the type map");
    });
  });

  describe('generateTypesContent', () => {
    const testDir = join(rootTestDir, 'generateTypesContent');
    const typeMap: TypeMap = new Map([['.Bar', { type: 'Bar', relativePath: 'foo.types' }]]);
    let service: Service;

    beforeEach(() => {
      service = new Service(rootTestDir);
    });

    afterEach(() => {
      rmSync(testDir, { recursive: true, force: true });
    });

    it('should generate a Typescript interface with a single field from a Protobuf message', async () => {
      const messageType = DescriptorProto.create({
        name: 'Foo',
        field: [
          FieldDescriptorProto.create({
            name: 'bar',
            label: FieldDescriptorProto_Label.REQUIRED,
            type: FieldDescriptorProto_Type.DOUBLE,
          }),
        ],
      });
      const fileDescriptorProto = FileDescriptorProto.create({
        package: '',
        name: '',
        messageType: [messageType],
      });

      const result = await generateTypesContent(service, fileDescriptorProto, typeMap);
      const trimmedResult = result.getContent().trim();

      const expected = trimPadding(`
        /* eslint-disable */
        export interface Foo {
          bar: number;
        }
      `).trim();

      expect(trimmedResult).toEqual(expected);
    });

    it('should generate a Typescript interface with multiple fields from a Protobuf message', async () => {
      const messageTypes = [
        DescriptorProto.create({
          name: 'Foo',
          field: [
            FieldDescriptorProto.create({
              name: 'bar',
              label: FieldDescriptorProto_Label.REQUIRED,
              type: FieldDescriptorProto_Type.DOUBLE,
            }),
            FieldDescriptorProto.create({
              name: 'baz',
              label: FieldDescriptorProto_Label.REQUIRED,
              type: FieldDescriptorProto_Type.DOUBLE,
            }),
          ],
        }),
      ];
      const fileDescriptorProto = FileDescriptorProto.create({
        package: '',
        name: '',
        messageType: messageTypes,
      });

      const result = await generateTypesContent(service, fileDescriptorProto, typeMap);
      const trimmedResult = result.getContent().trim();

      const expected = trimPadding(`
        /* eslint-disable */
        export interface Foo {
          bar: number;
          baz: number;
        }
      `).trim();

      expect(trimmedResult).toEqual(expected);
    });

    it('should generate multiple Typescript interfaces from multiple Protobuf messages', async () => {
      const messageTypes = [
        DescriptorProto.create({
          name: 'Foo',
          field: [
            FieldDescriptorProto.create({
              name: 'bar',
              label: FieldDescriptorProto_Label.REQUIRED,
              type: FieldDescriptorProto_Type.DOUBLE,
            }),
            FieldDescriptorProto.create({
              name: 'baz',
              label: FieldDescriptorProto_Label.REQUIRED,
              type: FieldDescriptorProto_Type.DOUBLE,
            }),
          ],
        }),
        DescriptorProto.create({
          name: 'Test',
          field: [
            FieldDescriptorProto.create({
              name: 'thing',
              label: FieldDescriptorProto_Label.REQUIRED,
              type: FieldDescriptorProto_Type.DOUBLE,
            }),
          ],
        }),
      ];
      const fileDescriptorProto = FileDescriptorProto.create({
        package: '',
        name: '',
        messageType: messageTypes,
      });

      const result = await generateTypesContent(service, fileDescriptorProto, typeMap);
      const trimmedResult = result.getContent().trim();

      const expected = trimPadding(`
        /* eslint-disable */
        export interface Foo {
          bar: number;
          baz: number;
        }

        export interface Test {
          thing: number;
        }
      `).trim();

      expect(trimmedResult).toEqual(expected);
    });

    it('should mark optional Protobuf fields with Typescript optional markers', async () => {
      const messageType = DescriptorProto.create({
        name: 'Foo',
        field: [
          FieldDescriptorProto.create({
            name: 'bar',
            label: FieldDescriptorProto_Label.OPTIONAL,
            type: FieldDescriptorProto_Type.DOUBLE,
          }),
        ],
      });
      const fileDescriptorProto = FileDescriptorProto.create({
        package: '',
        name: '',
        messageType: [messageType],
      });

      const result = await generateTypesContent(service, fileDescriptorProto, typeMap);
      const trimmedResult = result.getContent().trim();

      const expected = trimPadding(`
        /* eslint-disable */
        export interface Foo {
          bar?: number;
        }
      `).trim();

      expect(trimmedResult).toEqual(expected);
    });

    it('should mark repeated Protobuf fields as a Typescript array', async () => {
      const messageType = DescriptorProto.create({
        name: 'Foo',
        field: [
          FieldDescriptorProto.create({
            name: 'bar',
            label: FieldDescriptorProto_Label.REPEATED,
            type: FieldDescriptorProto_Type.DOUBLE,
          }),
        ],
      });
      const fileDescriptorProto = FileDescriptorProto.create({
        package: '',
        name: '',
        messageType: [messageType],
      });

      const result = await generateTypesContent(service, fileDescriptorProto, typeMap);
      const trimmedResult = result.getContent().trim();

      const expected = trimPadding(`
        /* eslint-disable */
        export interface Foo {
          bar: number[];
        }
      `).trim();

      expect(trimmedResult).toEqual(expected);
    });

    it('should throw an error if the Protobuf label for a field is unspecified', async () => {
      const messageType = DescriptorProto.create({
        name: 'Foo',
        field: [
          FieldDescriptorProto.create({
            name: 'bar',
            label: FieldDescriptorProto_Label.UNSPECIFIED$,
            type: FieldDescriptorProto_Type.DOUBLE,
          }),
        ],
      });
      const fileDescriptorProto = FileDescriptorProto.create({
        package: '',
        name: '',
        messageType: [messageType],
      });

      let error: Error | undefined;
      try {
        await generateTypesContent(service, fileDescriptorProto, typeMap);
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error?.message).toEqual('Unknown field label type: 0');
    });

    it.each`
      protobufType                              | stringProtobufType | typescriptType
      ${FieldDescriptorProto_Type.DOUBLE}       | ${'DOUBLE'}        | ${'number'}
      ${FieldDescriptorProto_Type.FLOAT}        | ${'FLOAT'}         | ${'number'}
      ${FieldDescriptorProto_Type.INT64}        | ${'INT64'}         | ${'number'}
      ${FieldDescriptorProto_Type.UINT64}       | ${'UINT64'}        | ${'number'}
      ${FieldDescriptorProto_Type.INT32}        | ${'INT32'}         | ${'number'}
      ${FieldDescriptorProto_Type.FIXED64}      | ${'FIXED64'}       | ${'number'}
      ${FieldDescriptorProto_Type.FIXED32}      | ${'FIXED32'}       | ${'number'}
      ${FieldDescriptorProto_Type.BOOL}         | ${'BOOL'}          | ${'boolean'}
      ${FieldDescriptorProto_Type.STRING}       | ${'STRING'}        | ${'string'}
      ${FieldDescriptorProto_Type.GROUP}        | ${'GROUP'}         | ${'never'}
      ${FieldDescriptorProto_Type.BYTES}        | ${'BYTES'}         | ${'never'}
      ${FieldDescriptorProto_Type.UINT32}       | ${'UINT32'}        | ${'number'}
      ${FieldDescriptorProto_Type.SFIXED32}     | ${'SFIXED32'}      | ${'number'}
      ${FieldDescriptorProto_Type.SFIXED64}     | ${'SFIXED64'}      | ${'number'}
      ${FieldDescriptorProto_Type.SINT32}       | ${'SINT32}'}       | ${'number'}
      ${FieldDescriptorProto_Type.SINT64}       | ${'SINT64'}        | ${'number'}
      ${FieldDescriptorProto_Type.UNSPECIFIED$} | ${'UNSPECIFIED$'}  | ${'never'}
    `(
      "should use '$typescriptType' as the Typescript field type when the Protobuf field type is '$stringProtobufType'",
      async ({ protobufType, typescriptType }) => {
        const messageType = DescriptorProto.create({
          name: 'Foo',
          field: [
            FieldDescriptorProto.create({
              name: 'bar',
              label: FieldDescriptorProto_Label.REQUIRED,
              type: protobufType,
            }),
          ],
        });
        const fileDescriptorProto = FileDescriptorProto.create({
          package: '',
          name: '',
          messageType: [messageType],
        });

        const result = await generateTypesContent(service, fileDescriptorProto, typeMap);
        const trimmedResult = result.getContent().trim();

        const expected = trimPadding(`
        /* eslint-disable */
        export interface Foo {
          bar: ${typescriptType};
        }
      `).trim();

        expect(trimmedResult).toEqual(expected);
      },
    );

    it("should use the relevant field from the type map as the Typescript field type when the Protobuf message field type is 'TYPE_ENUM'", async () => {
      const messageType = DescriptorProto.create({
        name: 'Foo',
        field: [
          FieldDescriptorProto.create({
            name: 'bar',
            label: FieldDescriptorProto_Label.REQUIRED,
            type: FieldDescriptorProto_Type.ENUM,
            typeName: '.Bar',
          }),
        ],
      });
      const fileDescriptorProto = FileDescriptorProto.create({
        package: '',
        name: '',
        messageType: [messageType],
      });

      const result = await generateTypesContent(service, fileDescriptorProto, typeMap);
      const trimmedResult = result.getContent().trim();

      const expected = trimPadding(`
        /* eslint-disable */
        import { Bar } from './foo.types';

        export interface Foo {
          bar: Bar;
        }
      `).trim();

      expect(trimmedResult).toEqual(expected);
    });

    it("should use the relevant field from the type map as the Typescript field type when the Protobuf message field type is 'TYPE_MESSAGE'", async () => {
      const messageType = DescriptorProto.create({
        name: 'Foo',
        field: [
          FieldDescriptorProto.create({
            name: 'bar',
            label: FieldDescriptorProto_Label.REQUIRED,
            type: FieldDescriptorProto_Type.MESSAGE,
            typeName: '.Bar',
          }),
        ],
      });
      const fileDescriptorProto = FileDescriptorProto.create({
        package: '',
        name: '',
        messageType: [messageType],
      });

      const result = await generateTypesContent(service, fileDescriptorProto, typeMap);
      const trimmedResult = result.getContent().trim();

      const expected = trimPadding(`
        /* eslint-disable */
        import { Bar } from './foo.types';

        export interface Foo {
          bar: Bar;
        }
      `).trim();

      expect(trimmedResult).toEqual(expected);
    });

    it('should generate a Typescript enum from a Protobuf enum', async () => {
      const enumName = 'Foo';
      const enumValue1 = EnumValueDescriptorProto.create({ name: 'FOO', number: 1 });
      const enumValue2 = EnumValueDescriptorProto.create({ name: 'BAR', number: 1 });
      const enumValue3 = EnumValueDescriptorProto.create({ name: 'BAZ', number: 1 });
      const enumType = EnumDescriptorProto.create({
        name: enumName,
        value: [enumValue1, enumValue2, enumValue3],
      });
      const fileDescriptorProto = FileDescriptorProto.create({
        package: '',
        name: 'foos.proto',
        enumType: [enumType],
      });

      const result = await generateTypesContent(service, fileDescriptorProto, typeMap);
      const trimmedResult = result.getContent().trim();

      const expected = trimPadding(`
        /* eslint-disable */
        export enum ${enumName} {
          ${enumValue1.name} = ${enumValue1.number},
          ${enumValue2.name} = ${enumValue2.number},
          ${enumValue3.name} = ${enumValue3.number},
        }
      `).trim();

      expect(trimmedResult).toEqual(expected);
    });
  });
});
