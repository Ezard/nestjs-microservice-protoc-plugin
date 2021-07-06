import { FileDescriptorProto, GeneratedFile, MethodDescriptorProto } from '@protobuf-ts/plugin-framework';
import { join } from 'path';
import { util } from 'protobufjs';
import { code, Code, imp } from 'ts-poet';
import { Service } from './core';
import { getImpFromTypeName, TypeMap } from './types';
import normalize = util.path.normalize;

const Observable = imp('Observable@rxjs');

function prefixDisableLinter(fileContents: string): string {
  return `/* eslint-disable */
${fileContents}`;
}

export async function createGeneratedFile(
  service: Service,
  fileDescriptorProto: FileDescriptorProto,
  type: 'types' | 'backend' | 'frontend',
  codeContent: Code,
): Promise<GeneratedFile> {
  assertDefined(fileDescriptorProto.package);
  assertDefined(fileDescriptorProto.name);
  const directory = fileDescriptorProto.package.replace('.', '/');
  const fileName = `${fileDescriptorProto.name.replace('.proto', '')}.${type}.ts`;
  const relativePath = normalize(join(directory, fileName));
  const fullPath = normalize(join(service.generatedDir, relativePath));
  const content = prefixDisableLinter(await codeContent.toStringWithImports({ path: relativePath }));
  return {
    getFilename: () => fullPath,
    getContent: () => content,
  };
}

export async function createGeneratedFileForBackendMicroserviceOptions(
  service: Service,
  codeContent: Code,
): Promise<GeneratedFile> {
  const fullPath = normalize(join(service.generatedDir, 'backend-microservice-options.ts'));
  const content = prefixDisableLinter(await codeContent.toStringWithImports());
  return {
    getFilename: () => fullPath,
    getContent: () => content,
  };
}

export function combineCode(acc: Code, cur: Code): Code {
  return code`${acc}\n${cur}`;
}

function getInputType(inputType: string, typeMap: TypeMap): Code {
  return getImpFromTypeName(typeMap, inputType);
}

function getNormalOutputType(outputType: string, typeMap: TypeMap): Code {
  return getImpFromTypeName(typeMap, outputType);
}

function getPromiseOutputType(outputType: string, typeMap: TypeMap): Code {
  return code`Promise<${getImpFromTypeName(typeMap, outputType)}>`;
}

function getObservableOutputType(outputType: string, typeMap: TypeMap): Code {
  return code`${Observable}<${getImpFromTypeName(typeMap, outputType)}>`;
}

function getOutputType(outputType: string, typeMap: TypeMap): Code {
  return code`${getNormalOutputType(outputType, typeMap)}
                | ${getPromiseOutputType(outputType, typeMap)}
                | ${getObservableOutputType(outputType, typeMap)}`;
}

export function getMethodDefinition({ name, inputType, outputType }: MethodDescriptorProto, typeMap: TypeMap): Code {
  assertDefined(inputType);
  assertDefined(outputType);
  return code`${name}(request: ${getInputType(inputType, typeMap)}): ${getOutputType(outputType, typeMap)}`;
}

export function assertDefined<T>(value: T): asserts value is NonNullable<T> {
  if (value === undefined || value === null) {
    throw new Error(`Variable was not defined when it should be`);
  }
}
