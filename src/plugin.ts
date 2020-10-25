import { google } from 'ts-proto/build/pbjs';
import { promisify } from 'util';
import { generateFiles } from './core';
import { readToBuffer } from './utils';
import CodeGeneratorRequest = google.protobuf.compiler.CodeGeneratorRequest;
import CodeGeneratorResponse = google.protobuf.compiler.CodeGeneratorResponse;
import Feature = google.protobuf.compiler.CodeGeneratorResponse.Feature;

async function main() {
  const input = await readToBuffer(process.stdin);
  const request = CodeGeneratorRequest.decode(input);
  const args = request.parameter.split(',');

  const servicesFile = args.find(arg => /services_file=.+/.test(arg))?.split('=')?.[1];
  if (!servicesFile) {
    throw new Error('"services_file" parameter must be specified e.g. --ts_proto_opt=services_file=services.json');
  }

  const protosDir = args.find(arg => /protos_dir=.+/.test(arg))?.split('=')?.[1];
  if (!protosDir) {
    throw new Error('"protos_dir" parameter must be specified e.g. --ts_proto_opt=protos_dir=../protos');
  }

  const files = await generateFiles(request.protoFile, servicesFile, protosDir);

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
    process.exit(1);
  });
