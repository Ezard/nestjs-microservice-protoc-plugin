import { Writer } from 'protobufjs';
import { google } from 'ts-proto/build/pbjs';
import CodeGeneratorRequest = google.protobuf.compiler.CodeGeneratorRequest;
import CodeGeneratorResponse = google.protobuf.compiler.CodeGeneratorResponse;
import FileDescriptorProto = google.protobuf.FileDescriptorProto;

describe('plugin', () => {
  describe('main', () => {
    let generateFiles: jest.Mock<unknown, unknown[]>;

    beforeEach(() => {
      // noinspection JSUnusedGlobalSymbols
      jest.mock('./utils', () => ({
        readToBuffer: () => Promise.resolve(),
      }));
      generateFiles = jest.fn();
      jest.mock('./core', () => ({
        generateFiles,
      }));
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    function nextTick(): Promise<void> {
      return new Promise(process.nextTick);
    }

    function mockProcessStdoutWrite(): jest.SpyInstance<
      ReturnType<Required<NodeJS.WriteStream & { fd: 1 }>['write']>,
      jest.ArgsType<Required<NodeJS.WriteStream & { fd: 1 }>['write']>
    > {
      return jest.spyOn(process.stdout, 'write').mockImplementation((buffer, cb) => {
        ((cb as unknown) as () => void)();
        return true;
      });
    }

    function mockProcessStderrWrite(): jest.SpyInstance<
      ReturnType<Required<NodeJS.WriteStream & { fd: 2 }>['write']>,
      jest.ArgsType<Required<NodeJS.WriteStream & { fd: 2 }>['write']>
    > {
      return jest.spyOn(process.stderr, 'write').mockImplementation();
    }

    function mockProcessExit(): jest.SpyInstance<
      ReturnType<Required<NodeJS.Process>['exit']>,
      jest.ArgsType<Required<NodeJS.Process>['exit']>
    > {
      return jest.spyOn(process, 'exit').mockImplementation();
    }

    it('should exit the current process when successful', async () => {
      generateFiles.mockReturnValue([]);
      const servicesFile = 'services.json';
      const protosDir = 'protos';
      jest.spyOn(CodeGeneratorRequest, 'decode').mockReturnValue(
        new CodeGeneratorRequest({
          parameter: `services_file=${servicesFile},protos_dir=${protosDir}`,
          protoFile: [],
        }),
      );
      mockProcessStdoutWrite();
      const processExit = mockProcessExit();

      jest.isolateModules(() => require('./plugin'));

      await nextTick();

      expect(processExit).toHaveBeenCalledWith(0);
    });
    it('should pass files array, services file and protos directory to generateFiles function', async () => {
      generateFiles.mockReturnValue([]);
      const fileDescriptorProtos = [
        new FileDescriptorProto({
          name: 'foo.proto',
        }),
        new FileDescriptorProto({
          name: 'bar.proto',
        }),
      ];
      const servicesFile = 'services.json';
      const protosDir = 'protos';
      jest.spyOn(CodeGeneratorRequest, 'decode').mockReturnValue(
        new CodeGeneratorRequest({
          parameter: `services_file=${servicesFile},protos_dir=${protosDir}`,
          protoFile: fileDescriptorProtos,
        }),
      );
      mockProcessStdoutWrite();
      const processExit = mockProcessExit();

      jest.isolateModules(() => require('./plugin'));

      await nextTick();

      expect(processExit).toHaveBeenCalledWith(0);
      expect(generateFiles).toHaveBeenCalledWith(fileDescriptorProtos, servicesFile, protosDir);
    });
    it('should pass the generated files to CodeGeneratorResponse.encode', async () => {
      const files = [
        new CodeGeneratorResponse.File({
          name: 'foo.ts',
          content: 'foo',
        }),
        new CodeGeneratorResponse.File({
          name: 'bar.ts',
          content: 'bar',
        }),
      ];
      generateFiles.mockReturnValue(files);
      const servicesFile = 'services.json';
      const protosDir = 'protos';
      jest.spyOn(CodeGeneratorRequest, 'decode').mockReturnValue(
        new CodeGeneratorRequest({
          parameter: `services_file=${servicesFile},protos_dir=${protosDir}`,
          protoFile: [],
        }),
      );
      const codeGeneratorResponseEncode = jest.fn().mockReturnValue(new Writer());
      jest.spyOn(CodeGeneratorResponse, 'encode').mockImplementation(codeGeneratorResponseEncode);
      mockProcessStdoutWrite();
      const processExit = mockProcessExit();

      jest.isolateModules(() => require('./plugin'));

      await nextTick();

      expect(processExit).toHaveBeenCalledWith(0);
      expect(codeGeneratorResponseEncode).toHaveBeenCalledWith(new CodeGeneratorResponse({ file: files }));
    });
    it("should throw an error if 'services_file' argument is not specified", async () => {
      generateFiles.mockReturnValue([]);
      jest
        .spyOn(CodeGeneratorRequest, 'decode')
        .mockReturnValue(new CodeGeneratorRequest({ parameter: 'protos_dir=protos' }));
      const processStderrWrite = mockProcessStderrWrite();
      const processExit = mockProcessExit();

      jest.isolateModules(() => require('./plugin'));

      await nextTick();

      expect(processStderrWrite).toHaveBeenNthCalledWith(1, 'FAILED');
      expect(processStderrWrite).toHaveBeenNthCalledWith(
        2,
        '"services_file" parameter must be specified e.g. --ts_proto_opt=services_file=services.json',
      );
      expect(processExit).toHaveBeenCalledWith(1);
    });
    it("should throw an error if 'protos_dir' argument is not specified", async () => {
      generateFiles.mockReturnValue([]);
      jest
        .spyOn(CodeGeneratorRequest, 'decode')
        .mockReturnValue(new CodeGeneratorRequest({ parameter: 'services_file=services.json' }));
      const processStderrWrite = mockProcessStderrWrite();
      const processExit = mockProcessExit();

      jest.isolateModules(() => require('./plugin'));

      await nextTick();

      expect(processStderrWrite).toHaveBeenNthCalledWith(1, 'FAILED');
      expect(processStderrWrite).toHaveBeenNthCalledWith(
        2,
        '"protos_dir" parameter must be specified e.g. --ts_proto_opt=protos_dir=../protos',
      );
      expect(processExit).toHaveBeenCalledWith(1);
    });
  });
});