import { CodeGeneratorRequest, FileDescriptorProto } from '@protobuf-ts/plugin-framework';
import { generateFiles } from './core';
import { NestjsMicroservicePlugin } from './nestjs-microservice-plugin';

jest.mock('./core', () => ({
  generateFiles: jest.fn(),
}));

describe('NestjsMicroservicePlugin', () => {
  describe('main', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should pass files array, services file and protos directory to generateFiles function', async () => {
      (generateFiles as jest.Mock).mockReturnValue([]);
      const fileDescriptorProtos = [
        FileDescriptorProto.create({
          name: 'foo.proto',
        }),
        FileDescriptorProto.create({
          name: 'bar.proto',
        }),
      ];
      const servicesFile = 'services.json';
      const protosDir = 'protos';
      const request = CodeGeneratorRequest.create({
        parameter: `services_file=${servicesFile},protos_dir=${protosDir}`,
        protoFile: fileDescriptorProtos,
        fileToGenerate: [],
      });

      await new NestjsMicroservicePlugin().generate(request);

      expect(generateFiles).toHaveBeenCalledWith(fileDescriptorProtos, servicesFile, protosDir);
    });
    it("should throw an error if 'services_file' argument is not specified", async () => {
      (generateFiles as jest.Mock).mockReturnValue([]);
      const request = CodeGeneratorRequest.create({ parameter: 'protos_dir=protos' });

      const result = new NestjsMicroservicePlugin().generate(request);

      await expect(result).rejects.toEqual(
        new Error('"services_file" parameter must be specified e.g. --ts_proto_opt=services_file=services.json'),
      );
    });
    it("should throw an error if 'protos_dir' argument is not specified", async () => {
      (generateFiles as jest.Mock).mockReturnValue([]);
      const request = CodeGeneratorRequest.create({ parameter: 'services_file=services.json' });

      const result = new NestjsMicroservicePlugin().generate(request);

      await expect(result).rejects.toEqual(
        new Error('"protos_dir" parameter must be specified e.g. --ts_proto_opt=protos_dir=../protos'),
      );
    });
  });
});
