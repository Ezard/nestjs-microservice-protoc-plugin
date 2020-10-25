import { rmdirSync } from 'fs';
import { join } from 'path';
import { util } from 'protobufjs';
import { PassThrough } from 'stream';
import { code, imp } from 'ts-poet';
import { google } from 'ts-proto/build/pbjs';
import { trimPadding } from '../test/utils';
import { Service } from './core';
import { TypeMap } from './types';
import {
  combineCode,
  createCodeGeneratorResponseFile,
  createCodeGeneratorResponseFileForBackendMicroserviceOptions,
  getMethodDefinition,
  readToBuffer,
} from './utils';
import FileDescriptorProto = google.protobuf.FileDescriptorProto;
import MethodDescriptorProto = google.protobuf.MethodDescriptorProto;
import normalize = util.path.normalize;

// noinspection JSUnusedGlobalSymbols
jest.mock('./types', () => ({
  getImpFromTypeName: (typeMap: TypeMap, typeName: string) => code`${typeName}`,
}));

describe('utils', () => {
  describe('readToBuffer', () => {
    it('should return the contents of the stream as a buffer', async () => {
      const stream = new PassThrough();
      const data = Buffer.from('Foo\nBar\nBaz', 'utf-8');

      process.nextTick(() => {
        stream.emit('data', data);
        stream.end();
        stream.destroy();
      });

      const result = await readToBuffer(stream);

      expect(result).toEqual(data);
    });
  });

  describe('createCodeGeneratorResponseFile', () => {
    const rootDir = 'createCodeGeneratorResponseFile-test';
    const fileName = 'foo.proto';
    let service: Service;

    beforeEach(() => {
      service = new Service(rootDir);
    });

    afterEach(() => {
      rmdirSync(service.generatedDir);
      rmdirSync(service.protosDir);
      rmdirSync(rootDir);
    });

    it.each`
      type
      ${'types'}
      ${'backend'}
      ${'frontend'}
    `('should use .$type.ts as the file extension when the type is $type', async ({ type }) => {
      const result = await createCodeGeneratorResponseFile(
        service,
        new FileDescriptorProto({
          name: fileName,
          package: 'foo',
        }),
        type,
        code``,
      );

      expect(result.name.endsWith(`.${type}.ts`)).toBe(true);
    });

    it('should prefix code content with a comment to disable ESLint', async () => {
      const codeContent = code`
        class Foo {}

        const bar: ${imp('Baz@./baz')}
      `;

      const result = await createCodeGeneratorResponseFile(
        service,
        new FileDescriptorProto({
          name: fileName,
          package: 'foo',
        }),
        'frontend',
        codeContent,
      );
      const lines = result.content.split(/\r\n?|\n/);

      expect(lines[0]).toEqual('/* eslint-disable */');
    });

    it.each`
      packageName  | importPath
      ${''}        | ${'./baz'}
      ${'foo'}     | ${'../baz'}
      ${'foo.bar'} | ${'../../baz'}
    `(
      "should use '$importPath' as the import path when the package is '$packageName'",
      async ({ packageName, importPath }) => {
        const codeContent = code`
        class Foo {}

        const bar: ${imp('Baz@./baz')}
      `;

        const result = await createCodeGeneratorResponseFile(
          service,
          new FileDescriptorProto({
            name: fileName,
            package: packageName,
          }),
          'frontend',
          codeContent,
        );
        const lines = result.content.split(/\r\n?|\n/);

        expect(lines[1]).toEqual(`import { Baz } from '${importPath}';`);
      },
    );
  });

  describe('createCodeGeneratorResponseFileForBackendMicroserviceOptions', () => {
    const rootDir = 'createCodeGeneratorResponseFile-test';
    const service = new Service(rootDir);

    it("should generate the file in the service's 'generated' directory", async () => {
      const result = await createCodeGeneratorResponseFileForBackendMicroserviceOptions(service, code``);

      const expectedFilePath = normalize(join(service.generatedDir, 'backend-microservice-options.ts'));

      expect(result.name).toEqual(expectedFilePath);
    });

    it('should prefix code content with a comment to disable ESLint', async () => {
      const result = await createCodeGeneratorResponseFileForBackendMicroserviceOptions(service, code``);
      const lines = result.content.split(/\r\n?|\n/);

      expect(lines[0]).toEqual('/* eslint-disable */');
    });
  });

  describe('combineCode', () => {
    it('should return the two input code blocks separated by a newline', async () => {
      const codeA = code`class Foo {}`;
      const codeB = code`const bar: ${imp('Observable@rxjs')}`;

      const result = await combineCode(codeA, codeB).toStringWithImports('.');

      const expected = trimPadding(`
        import { Observable } from 'rxjs';

        class Foo {}
        const bar: Observable;
      `).trim();

      expect(result.trim()).toEqual(expected);
    });
  });

  describe('getMethodDefinition', () => {
    it('should render based on the provided input and output', () => {
      // use code.toString()
      const name = 'Foo';
      const inputType = 'Bar';
      const outputType = 'Baz';
      const methodDescriptorProto = new MethodDescriptorProto({
        name,
        inputType,
        outputType,
        clientStreaming: false,
        serverStreaming: false,
      });
      const typeMap: TypeMap = new Map();

      const result = getMethodDefinition(methodDescriptorProto, typeMap).toString().trim();

      const expected = trimPadding(`
        Foo(request: Bar): Baz
                        | Promise<Baz>
                        | Observable<Baz>
      `).trim();

      expect(result).toEqual(expected);
    });
  });
});
