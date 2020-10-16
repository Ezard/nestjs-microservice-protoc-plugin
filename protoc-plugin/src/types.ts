import { code, Code, imp } from 'ts-poet';
import { google } from 'ts-proto/build/pbjs';
import { Service } from './core';
import { combineCode, createCodeGeneratorResponseFile } from './utils';
import CodeGeneratorResponse = google.protobuf.compiler.CodeGeneratorResponse;
import DescriptorProto = google.protobuf.DescriptorProto;
import FieldDescriptorProto = google.protobuf.FieldDescriptorProto;
import Label = google.protobuf.FieldDescriptorProto.Label;
import Type = google.protobuf.FieldDescriptorProto.Type;
import FileDescriptorProto = google.protobuf.FileDescriptorProto;

export type TypeMap = Map<string, { type: string; relativePath: string }>;

export function generateTypeMap(fileDescriptorProtos: FileDescriptorProto[]): TypeMap {
  return new Map(
    fileDescriptorProtos.flatMap(fileDescriptorProto =>
      fileDescriptorProto.messageType.map(messageType => {
        const packageName = fileDescriptorProto.package;
        const type = messageType.name;
        const relativePath = `${packageName.replace('.', '/')}/${fileDescriptorProto.name.replace('.proto', '')}.types`;
        const key = `.${packageName}.${type}`;
        const value = { type, relativePath };
        return [key, value];
      }),
    ),
  );
}

export function getImpFromTypeName(typeMap: TypeMap, typeName: string): Code {
  const result = typeMap.get(typeName);
  if (!result) {
    throw new Error(`Type '${typeName}' was not found in the type map`);
  }
  const importStatement = imp(`${result.type}@./${result.relativePath}`);
  return code`${importStatement}`;
}

function getType(service: Service, field: FieldDescriptorProto, typeMap: TypeMap): string | Code {
  switch (field.type) {
    case Type.TYPE_DOUBLE:
      return 'number';
    case Type.TYPE_FLOAT:
      return 'number';
    case Type.TYPE_INT64:
      return 'number';
    case Type.TYPE_UINT64:
      return 'number';
    case Type.TYPE_INT32:
      return 'number';
    case Type.TYPE_FIXED64:
      return 'number';
    case Type.TYPE_FIXED32:
      return 'number';
    case Type.TYPE_BOOL:
      return 'boolean';
    case Type.TYPE_STRING:
      return 'string';
    case Type.TYPE_GROUP:
      return 'undefined';
    case Type.TYPE_MESSAGE:
      return getImpFromTypeName(typeMap, field.typeName);
    case Type.TYPE_BYTES:
      return 'undefined';
    case Type.TYPE_UINT32:
      return 'number';
    case Type.TYPE_ENUM:
      return code`${typeMap[field.typeName]}`;
    case Type.TYPE_SFIXED32:
      return 'number';
    case Type.TYPE_SFIXED64:
      return 'number';
    case Type.TYPE_SINT32:
      return 'number';
    case Type.TYPE_SINT64:
      return 'number';
  }
}

function generateFields(service: Service, messageType: DescriptorProto, typeMap: TypeMap): Code {
  return messageType.field
    .map(field => {
      switch (field.label) {
        case Label.LABEL_OPTIONAL:
          return code`  ${field.name}?: ${getType(service, field, typeMap)};`;
        case Label.LABEL_REQUIRED:
          return code`  ${field.name}: ${getType(service, field, typeMap)};`;
        case Label.LABEL_REPEATED:
          return code`  ${field.name}: ${getType(service, field, typeMap)}[];`;
      }
    })
    .reduce(combineCode);
}

function generateMessageInterfaces(service: Service, messageTypes: DescriptorProto[], typeMap: TypeMap): Code {
  return messageTypes
    .map(
      messageType =>
        code`
              export interface ${messageType.name} {
                ${generateFields(service, messageType, typeMap)}
              }
            `,
    )
    .reduce(combineCode);
}

export async function generateTypesContent(
  service: Service,
  fileDescriptorProto: FileDescriptorProto,
  typeMap: TypeMap,
): Promise<CodeGeneratorResponse.File> {
  const codeContent = generateMessageInterfaces(service, fileDescriptorProto.messageType, typeMap);
  return createCodeGeneratorResponseFile(service, fileDescriptorProto, 'types', codeContent);
}
