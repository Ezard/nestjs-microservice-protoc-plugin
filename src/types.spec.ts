import { rmdirSync } from 'fs';
import { code } from 'ts-poet';
import { google } from 'ts-proto/build/pbjs';
import { trimPadding } from '../test/utils';
import { Service } from './core';
import { generateTypeMap, generateTypesContent, getImpFromTypeName, TypeMap } from './types';
import DescriptorProto = google.protobuf.DescriptorProto;
import EnumDescriptorProto = google.protobuf.EnumDescriptorProto;
import EnumValueDescriptorProto = google.protobuf.EnumValueDescriptorProto;
import FieldDescriptorProto = google.protobuf.FieldDescriptorProto;
import Label = google.protobuf.FieldDescriptorProto.Label;
import Type = google.protobuf.FieldDescriptorProto.Type;
import FileDescriptorProto = google.protobuf.FileDescriptorProto;

describe('types', () => {
  describe('generateTypeMap', () => {
    it('should add types to the type map when no package name is specified', () => {
      const typeMap = generateTypeMap([
        new FileDescriptorProto({
          name: 'foos.proto',
          messageType: [new DescriptorProto({ name: 'Bar' })],
        }),
      ]);

      expect(typeMap.get('.Bar')).toBeDefined();
      expect(typeMap.get('.Bar')?.type).toEqual('Bar');
      expect(typeMap.get('.Bar')?.relativePath).toEqual('foos.types');
    });

    it('should add types to the type map when a single level package name is specified', () => {
      const typeMap = generateTypeMap([
        new FileDescriptorProto({
          name: 'foos.proto',
          package: 'foo',
          messageType: [new DescriptorProto({ name: 'Bar' })],
        }),
      ]);

      expect(typeMap.get('.foo.Bar')).toBeDefined();
      expect(typeMap.get('.foo.Bar')?.type).toEqual('Bar');
      expect(typeMap.get('.foo.Bar')?.relativePath).toEqual('foo/foos.types');
    });

    it('should add types to the type map when a multi-level package name is specified', () => {
      const typeMap = generateTypeMap([
        new FileDescriptorProto({
          name: 'foos.proto',
          package: 'foo.baz',
          messageType: [new DescriptorProto({ name: 'Bar' })],
        }),
      ]);

      expect(typeMap.get('.foo.baz.Bar')).toBeDefined();
      expect(typeMap.get('.foo.baz.Bar')?.type).toEqual('Bar');
      expect(typeMap.get('.foo.baz.Bar')?.relativePath).toEqual('foo/baz/foos.types');
    });

    it('should add enum types to the type map', () => {
      const enumName = 'Foo';
      const typeMap = generateTypeMap([
        new FileDescriptorProto({
          name: 'foos.proto',
          enumType: [
            new EnumDescriptorProto({
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
    });
  });

  describe('generateTypesContent', () => {
    const rootDir = './generateTypesContent-test';
    const service = new Service(rootDir);
    const typeMap: TypeMap = new Map([['.Bar', { type: 'Bar', relativePath: 'foo.types' }]]);

    it('should generate a Typescript interface with a single field from a Protobuf message', async () => {
      const messageType = new DescriptorProto({
        name: 'Foo',
        field: [
          new FieldDescriptorProto({
            name: 'bar',
            label: Label.LABEL_REQUIRED,
            type: Type.TYPE_DOUBLE,
          }),
        ],
      });
      const fileDescriptorProto = new FileDescriptorProto({
        messageType: [messageType],
      });

      const result = await generateTypesContent(service, fileDescriptorProto, typeMap);
      const trimmedResult = result.content.trim();

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
        new DescriptorProto({
          name: 'Foo',
          field: [
            new FieldDescriptorProto({
              name: 'bar',
              label: Label.LABEL_REQUIRED,
              type: Type.TYPE_DOUBLE,
            }),
            new FieldDescriptorProto({
              name: 'baz',
              label: Label.LABEL_REQUIRED,
              type: Type.TYPE_DOUBLE,
            }),
          ],
        }),
      ];
      const fileDescriptorProto = new FileDescriptorProto({
        messageType: messageTypes,
      });

      const result = await generateTypesContent(service, fileDescriptorProto, typeMap);
      const trimmedResult = result.content.trim();

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
        new DescriptorProto({
          name: 'Foo',
          field: [
            new FieldDescriptorProto({
              name: 'bar',
              label: Label.LABEL_REQUIRED,
              type: Type.TYPE_DOUBLE,
            }),
            new FieldDescriptorProto({
              name: 'baz',
              label: Label.LABEL_REQUIRED,
              type: Type.TYPE_DOUBLE,
            }),
          ],
        }),
        new DescriptorProto({
          name: 'Test',
          field: [
            new FieldDescriptorProto({
              name: 'thing',
              label: Label.LABEL_REQUIRED,
              type: Type.TYPE_DOUBLE,
            }),
          ],
        }),
      ];
      const fileDescriptorProto = new FileDescriptorProto({
        messageType: messageTypes,
      });

      const result = await generateTypesContent(service, fileDescriptorProto, typeMap);
      const trimmedResult = result.content.trim();

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
      const messageType = new DescriptorProto({
        name: 'Foo',
        field: [
          new FieldDescriptorProto({
            name: 'bar',
            label: Label.LABEL_OPTIONAL,
            type: Type.TYPE_DOUBLE,
          }),
        ],
      });
      const fileDescriptorProto = new FileDescriptorProto({
        messageType: [messageType],
      });

      const result = await generateTypesContent(service, fileDescriptorProto, typeMap);
      const trimmedResult = result.content.trim();

      const expected = trimPadding(`
        /* eslint-disable */
        export interface Foo {
          bar?: number;
        }
      `).trim();

      expect(trimmedResult).toEqual(expected);
    });

    it('should mark repeated Protobuf fields as a Typescript array', async () => {
      const messageType = new DescriptorProto({
        name: 'Foo',
        field: [
          new FieldDescriptorProto({
            name: 'bar',
            label: Label.LABEL_REPEATED,
            type: Type.TYPE_DOUBLE,
          }),
        ],
      });
      const fileDescriptorProto = new FileDescriptorProto({
        messageType: [messageType],
      });

      const result = await generateTypesContent(service, fileDescriptorProto, typeMap);
      const trimmedResult = result.content.trim();

      const expected = trimPadding(`
        /* eslint-disable */
        export interface Foo {
          bar: number[];
        }
      `).trim();

      expect(trimmedResult).toEqual(expected);
    });

    it.each`
      protobufType          | stringProtobufType | typescriptType
      ${Type.TYPE_DOUBLE}   | ${'TYPE_DOUBLE'}   | ${'number'}
      ${Type.TYPE_FLOAT}    | ${'TYPE_FLOAT'}    | ${'number'}
      ${Type.TYPE_INT64}    | ${'TYPE_INT64'}    | ${'number'}
      ${Type.TYPE_UINT64}   | ${'TYPE_UINT64'}   | ${'number'}
      ${Type.TYPE_INT32}    | ${'TYPE_INT32'}    | ${'number'}
      ${Type.TYPE_FIXED64}  | ${'TYPE_FIXED64'}  | ${'number'}
      ${Type.TYPE_FIXED32}  | ${'TYPE_FIXED32'}  | ${'number'}
      ${Type.TYPE_BOOL}     | ${'TYPE_BOOL'}     | ${'boolean'}
      ${Type.TYPE_STRING}   | ${'TYPE_STRING'}   | ${'string'}
      ${Type.TYPE_GROUP}    | ${'TYPE_GROUP'}    | ${'never'}
      ${Type.TYPE_BYTES}    | ${'TYPE_BYTES'}    | ${'never'}
      ${Type.TYPE_UINT32}   | ${'TYPE_UINT32'}   | ${'number'}
      ${Type.TYPE_SFIXED32} | ${'TYPE_SFIXED32'} | ${'number'}
      ${Type.TYPE_SFIXED64} | ${'TYPE_SFIXED64'} | ${'number'}
      ${Type.TYPE_SINT32}   | ${'TYPE_SINT32}'}  | ${'number'}
      ${Type.TYPE_SINT64}   | ${'TYPE_SINT64'}   | ${'number'}
    `(
      "should use '$typescriptType' as the Typescript field type when the Protobuf field type is '$stringProtobufType'",
      async ({ protobufType, typescriptType }) => {
        const messageType = new DescriptorProto({
          name: 'Foo',
          field: [
            new FieldDescriptorProto({
              name: 'bar',
              label: Label.LABEL_REQUIRED,
              type: protobufType,
            }),
          ],
        });
        const fileDescriptorProto = new FileDescriptorProto({
          messageType: [messageType],
        });

        const result = await generateTypesContent(service, fileDescriptorProto, typeMap);
        const trimmedResult = result.content.trim();

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
      const messageType = new DescriptorProto({
        name: 'Foo',
        field: [
          new FieldDescriptorProto({
            name: 'bar',
            label: Label.LABEL_REQUIRED,
            type: Type.TYPE_ENUM,
            typeName: '.Bar',
          }),
        ],
      });
      const fileDescriptorProto = new FileDescriptorProto({
        messageType: [messageType],
      });

      const result = await generateTypesContent(service, fileDescriptorProto, typeMap);
      const trimmedResult = result.content.trim();

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
      const messageType = new DescriptorProto({
        name: 'Foo',
        field: [
          new FieldDescriptorProto({
            name: 'bar',
            label: Label.LABEL_REQUIRED,
            type: Type.TYPE_MESSAGE,
            typeName: '.Bar',
          }),
        ],
      });
      const fileDescriptorProto = new FileDescriptorProto({
        messageType: [messageType],
      });

      const result = await generateTypesContent(service, fileDescriptorProto, typeMap);
      const trimmedResult = result.content.trim();

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
      const enumValue1 = new EnumValueDescriptorProto({ name: 'FOO', number: 1 });
      const enumValue2 = new EnumValueDescriptorProto({ name: 'BAR', number: 1 });
      const enumValue3 = new EnumValueDescriptorProto({ name: 'BAZ', number: 1 });
      const enumType = new EnumDescriptorProto({
        name: enumName,
        value: [enumValue1, enumValue2, enumValue3],
      });
      const fileDescriptorProto = new FileDescriptorProto({
        name: 'foos.proto',
        enumType: [enumType],
      });

      const result = await generateTypesContent(service, fileDescriptorProto, typeMap);
      const trimmedResult = result.content.trim();

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

    afterAll(() => {
      rmdirSync(`${rootDir}/generated`);
      rmdirSync(`${rootDir}/protos`);
      rmdirSync(`${rootDir}`);
    });
  });
});
