import { FileDescriptorProto, MethodDescriptorProto } from '@protobuf-ts/plugin-framework';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { util } from 'protobufjs';
import { code, imp } from 'ts-poet';
import { BASE_TEST_DIR, trimPadding } from '../test/utils';
import { Service } from './core';
import { TypeMap } from './types';
import {
  assertDefined,
  combineCode,
  createGeneratedFile,
  createGeneratedFileForBackendMicroserviceOptions,
  getMethodDefinition,
} from './utils';
import normalize = util.path.normalize;

// noinspection JSUnusedGlobalSymbols
jest.mock('./types', () => ({
  getImpFromTypeName: (typeMap: TypeMap, typeName: string) => code`${typeName}`,
}));

describe('utils', () => {
  const rootTestDir = join(BASE_TEST_DIR, 'utils');

  beforeAll(() => {
    mkdirSync(rootTestDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(rootTestDir, { recursive: true, force: true });
  });

  describe('createGeneratedFile', () => {
    const testDir = join(rootTestDir, 'createCodeGeneratorResponseFile');
    const fileName = 'foo.proto';

    it.each`
      type
      ${'types'}
      ${'backend'}
      ${'frontend'}
    `('should use .$type.ts as the file extension when the type is $type', async ({ type }) => {
      const service = new Service(join(testDir, 'foo'));
      const result = await createGeneratedFile(
        service,
        FileDescriptorProto.create({
          name: fileName,
          package: 'foo',
        }),
        type,
        code``,
      );

      expect(result.getFilename().endsWith(`foo.${type}.ts`)).toBe(true);
    });

    it('should prefix code content with a comment to disable ESLint', async () => {
      const service = new Service(join(testDir, 'foo'));
      const codeContent = code`
        class Foo {}

        const bar: ${imp('Baz@./baz')}
      `;

      const result = await createGeneratedFile(
        service,
        FileDescriptorProto.create({
          name: fileName,
          package: 'foo',
        }),
        'frontend',
        codeContent,
      );
      const lines = result.getContent().split(/\r\n?|\n/);

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
        const service = new Service(join(testDir, 'foo'));
        const codeContent = code`
        class Foo {}

        const bar: ${imp('Baz@./baz')}
      `;

        const result = await createGeneratedFile(
          service,
          FileDescriptorProto.create({
            name: fileName,
            package: packageName,
          }),
          'frontend',
          codeContent,
        );
        const lines = result.getContent().split(/\r\n?|\n/);

        expect(lines[1]).toEqual(`import { Baz } from '${importPath}';`);
      },
    );
  });

  describe('createGeneratedFileForBackendMicroserviceOptions', () => {
    const testDir = join(rootTestDir, 'createCodeGeneratorResponseFileForBackendMicroserviceOptions');

    it("should generate the file in the service's 'generated' directory", async () => {
      const service = new Service(join(testDir, 'foo'));
      const result = await createGeneratedFileForBackendMicroserviceOptions(service, code``);

      const expectedFilePath = normalize(join(service.generatedDir, 'backend-microservice-options.ts'));

      expect(result.getFilename()).toEqual(expectedFilePath);
    });

    it('should prefix code content with a comment to disable ESLint', async () => {
      const service = new Service(join(testDir, 'foo'));
      const result = await createGeneratedFileForBackendMicroserviceOptions(service, code``);
      const lines = result.getContent().split(/\r\n?|\n/);

      expect(lines[0]).toEqual('/* eslint-disable */');
    });
  });

  describe('combineCode', () => {
    it('should return the two input code blocks separated by a newline', async () => {
      const codeA = code`class Foo {}`;
      const codeB = code`const bar: ${imp('Observable@rxjs')}`;

      const result = await combineCode(codeA, codeB).toStringWithImports();

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
      const name = 'Foo';
      const inputType = 'Bar';
      const outputType = 'Baz';
      const methodDescriptorProto: MethodDescriptorProto = {
        name,
        inputType,
        outputType,
        clientStreaming: false,
        serverStreaming: false,
      };
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

  describe('assertDefined', () => {
    it('should execute without errors when the argument is defined', () => {
      let threwError = false;

      try {
        assertDefined('');
      } catch {
        threwError = true;
      }

      expect(threwError).toEqual(false);
    });

    it('should throw an error when the argument is null', () => {
      let threwError = false;

      try {
        assertDefined(null);
      } catch {
        threwError = true;
      }

      expect(threwError).toEqual(true);
    });

    it('should include the variable name in the error message', () => {
      let error: Error | undefined;

      try {
        assertDefined(undefined);
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error?.message).toEqual('Variable was not defined when it should be');
    });
  });
});
