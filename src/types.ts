import {
  DescriptorProto,
  EnumDescriptorProto,
  FieldDescriptorProto,
  FieldDescriptorProto_Label,
  FieldDescriptorProto_Type,
  FileDescriptorProto,
  GeneratedFile,
} from '@protobuf-ts/plugin-framework';
import { code, Code, imp } from 'ts-poet';
import { Service } from './core';
import { assertDefined, combineCode, createGeneratedFile } from './utils';

export type TypeMap = Map<string, { type: string; relativePath: string }>;

export function generateTypeMap(fileDescriptorProtos: FileDescriptorProto[]): TypeMap {
  return new Map(
    fileDescriptorProtos
      .flatMap(fileDescriptorProto => {
        return [...fileDescriptorProto.messageType, ...fileDescriptorProto.enumType].map(messageType => {
          assertDefined(messageType.name);
          return { fileDescriptorProto, type: messageType.name };
        });
      })
      .map(({ fileDescriptorProto, type }) => {
        const packageName = fileDescriptorProto.package;
        let relativePath: string;
        let key: string;
        assertDefined(fileDescriptorProto.name);
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
  assertDefined(field.type);
  switch (field.type) {
    case FieldDescriptorProto_Type.DOUBLE:
    case FieldDescriptorProto_Type.FLOAT:
    case FieldDescriptorProto_Type.INT64:
    case FieldDescriptorProto_Type.UINT64:
    case FieldDescriptorProto_Type.INT32:
    case FieldDescriptorProto_Type.FIXED64:
    case FieldDescriptorProto_Type.FIXED32:
    case FieldDescriptorProto_Type.UINT32:
    case FieldDescriptorProto_Type.SFIXED32:
    case FieldDescriptorProto_Type.SFIXED64:
    case FieldDescriptorProto_Type.SINT32:
    case FieldDescriptorProto_Type.SINT64:
      return 'number';
    case FieldDescriptorProto_Type.BOOL:
      return 'boolean';
    case FieldDescriptorProto_Type.STRING:
      return 'string';
    case FieldDescriptorProto_Type.GROUP:
    case FieldDescriptorProto_Type.BYTES:
    case FieldDescriptorProto_Type.UNSPECIFIED$:
      return 'never';
    case FieldDescriptorProto_Type.MESSAGE:
    case FieldDescriptorProto_Type.ENUM:
      assertDefined(field.typeName);
      return getImpFromTypeName(typeMap, field.typeName);
  }
}

function generateFields(service: Service, messageType: DescriptorProto, typeMap: TypeMap): Code {
  return messageType.field
    .map(field => {
      assertDefined(field.label);
      switch (field.label) {
        case FieldDescriptorProto_Label.OPTIONAL:
          return code`  ${field.name}?: ${getType(service, field, typeMap)};`;
        case FieldDescriptorProto_Label.REQUIRED:
          return code`  ${field.name}: ${getType(service, field, typeMap)};`;
        case FieldDescriptorProto_Label.REPEATED:
          return code`  ${field.name}: ${getType(service, field, typeMap)}[];`;
        case FieldDescriptorProto_Label.UNSPECIFIED$:
          throw new Error(`Unknown field label type: ${field.label}`);
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
): Promise<GeneratedFile> {
  const codeContent = code`
    ${generateMessageInterfaces(service, fileDescriptorProto.messageType, typeMap)}
    ${generateEnums(service, fileDescriptorProto.enumType)}
  `;
  return createGeneratedFile(service, fileDescriptorProto, 'types', codeContent);
}
