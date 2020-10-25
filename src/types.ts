import { code, Code, imp } from 'ts-poet';
import { google } from 'ts-proto/build/pbjs';
import { Service } from './core';
import { combineCode, createCodeGeneratorResponseFile } from './utils';
import CodeGeneratorResponse = google.protobuf.compiler.CodeGeneratorResponse;
import DescriptorProto = google.protobuf.DescriptorProto;
import EnumDescriptorProto = google.protobuf.EnumDescriptorProto;
import FieldDescriptorProto = google.protobuf.FieldDescriptorProto;
import Label = google.protobuf.FieldDescriptorProto.Label;
import Type = google.protobuf.FieldDescriptorProto.Type;
import FileDescriptorProto = google.protobuf.FileDescriptorProto;

export type TypeMap = Map<string, { type: string; relativePath: string }>;

export function generateTypeMap(fileDescriptorProtos: FileDescriptorProto[]): TypeMap {
  return new Map(
    fileDescriptorProtos
      .flatMap(fileDescriptorProto => {
        return [
          ...fileDescriptorProto.messageType.map(messageType => ({ fileDescriptorProto, type: messageType.name })),
          ...fileDescriptorProto.enumType.map(messageType => ({ fileDescriptorProto, type: messageType.name })),
        ];
      })
      .map(({ fileDescriptorProto, type }) => {
        const packageName = fileDescriptorProto.package;
        let relativePath: string;
        let key: string;
        if (packageName) {
          relativePath = `${packageName.replace('.', '/')}/${fileDescriptorProto.name.replace('.proto', '')}.types`;
          key = `.${packageName}.${type}`;
        } else {
          relativePath = `${fileDescriptorProto.name.replace('.proto', '')}.types`;
          key = `.${type}`;
        }
        const value = { type, relativePath };
        return [key, value];
      }),
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
    case Type.TYPE_FLOAT:
    case Type.TYPE_INT64:
    case Type.TYPE_UINT64:
    case Type.TYPE_INT32:
    case Type.TYPE_FIXED64:
    case Type.TYPE_FIXED32:
    case Type.TYPE_UINT32:
    case Type.TYPE_SFIXED32:
    case Type.TYPE_SFIXED64:
    case Type.TYPE_SINT32:
    case Type.TYPE_SINT64:
      return 'number';
    case Type.TYPE_BOOL:
      return 'boolean';
    case Type.TYPE_STRING:
      return 'string';
    case Type.TYPE_GROUP:
    case Type.TYPE_BYTES:
      return 'never';
    case Type.TYPE_MESSAGE:
    case Type.TYPE_ENUM:
      return getImpFromTypeName(typeMap, field.typeName);
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
    .reduce(combineCode, code``);
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
    .reduce(combineCode, code``);
}

function generateEnums(service: Service, enumTypes: EnumDescriptorProto[]): Code {
  return enumTypes
    .map(enumType => {
      const values = enumType.value.map(value => `${value.name} = ${value.number},`);
      return code`
          export enum ${enumType.name} {
            ${values}
          }
        `;
    })
    .reduce(combineCode, code``);
}

export async function generateTypesContent(
  service: Service,
  fileDescriptorProto: FileDescriptorProto,
  typeMap: TypeMap,
): Promise<CodeGeneratorResponse.File> {
  const codeContent = code`
    ${generateMessageInterfaces(service, fileDescriptorProto.messageType, typeMap)}
    ${generateEnums(service, fileDescriptorProto.enumType)}
  `;
  return createCodeGeneratorResponseFile(service, fileDescriptorProto, 'types', codeContent);
}