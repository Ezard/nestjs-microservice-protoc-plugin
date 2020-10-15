import { unlinkSync, writeFileSync } from 'fs';
import { google } from 'ts-proto/build/pbjs';
import { promisify } from 'util';
import { generateBackendContent } from './backend-services';
import { determineServices, LOG } from './core';
import { generateFrontendContent } from './frontend-services';
import { generateTypeMap, generateTypesContent, TypeMap } from './types';
import { readToBuffer } from './utils';
import CodeGeneratorRequest = google.protobuf.compiler.CodeGeneratorRequest;
import CodeGeneratorResponse = google.protobuf.compiler.CodeGeneratorResponse;
import Feature = google.protobuf.compiler.CodeGeneratorResponse.Feature;
import FileDescriptorProto = google.protobuf.FileDescriptorProto;

async function generateFiles(
  protosDir: string,
  fileDescriptorProto: FileDescriptorProto,
  typeMap: TypeMap,
): Promise<CodeGeneratorResponse.File[]> {
  const { backendServices, frontendServices } = determineServices(fileDescriptorProto);
  return [
    ...(await Promise.all(
      [...backendServices, ...frontendServices].map(service =>
        generateTypesContent(service, fileDescriptorProto, typeMap),
      ),
    )),
    ...(await Promise.all(
      backendServices.map(service => generateBackendContent(service, fileDescriptorProto, typeMap)),
    )),
    ...(await Promise.all(
      frontendServices.map(service => generateFrontendContent(service, protosDir, fileDescriptorProto, typeMap)),
    )),
  ];
}

async function main() {
  writeFileSync(LOG, '');
  unlinkSync(LOG);
  const input = await readToBuffer(process.stdin);
  const request = CodeGeneratorRequest.decode(input);
  const args = request.parameter.split(',');
  const protosDir = args.find(arg => /protos_dir=.+/.test(arg))?.split('=')?.[1];

  if (!protosDir) {
    throw new Error('"protos_dir" parameter must be specified e.g. --ts_proto_opt=protos_dir=../protos');
  }

  const typeMap = generateTypeMap(request.protoFile);
  const files = (
    await Promise.all(
      request.protoFile.flatMap(fileDescriptorProto => generateFiles(protosDir, fileDescriptorProto, typeMap)),
    )
  ).reduce((acc, cur) => acc.concat(cur), []);
  const response = new CodeGeneratorResponse({
    file: files,
    supportedFeatures: Feature.FEATURE_PROTO3_OPTIONAL,
  });
  const buffer = CodeGeneratorResponse.encode(response).finish();
  const write = promisify(process.stdout.write as (buffer: Buffer) => boolean).bind(process.stdout);
  await write(Buffer.from(buffer));
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch(e => {
    process.stderr.write('FAILED');
    process.stderr.write(e.message);
    process.stderr.write(e.stack);
    process.exit(1);
  });
