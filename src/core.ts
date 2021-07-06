import { FileDescriptorProto, GeneratedFile } from '@protobuf-ts/plugin-framework';
import { mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { generateBackendContent, generateBackendMicroserviceOptionsFiles } from './backend-services';
import { generateFrontendContent } from './frontend-services';
import { generateTypeMap, generateTypesContent } from './types';

export class Service {
  readonly generatedDir: string;
  readonly protosDir: string;

  constructor(private readonly rootDir: string) {
    this.generatedDir = join(this.rootDir, 'generated');
    this.protosDir = join(this.rootDir, 'protos');
    mkdirSync(this.generatedDir, { recursive: true });
    mkdirSync(this.protosDir, { recursive: true });
  }
}

export interface Services {
  [key: string]: Service;
}

export function loadServices(filePath: string): Services {
  const data = JSON.parse(readFileSync(filePath, { encoding: 'utf-8' })) as { [s: string]: { rootDir: string } };
  const services = {} as Services;
  for (const [key, value] of Object.entries(data)) {
    services[key] = new Service(value.rootDir);
  }
  return services;
}

export function determineServices(
  services: Services,
  fileDescriptorProto: FileDescriptorProto,
): { backendServices: Service[]; frontendServices: Service[] } {
  const leadingDetachedComments = fileDescriptorProto.sourceCodeInfo?.location.flatMap(
    location => location.leadingDetachedComments,
  );
  if (leadingDetachedComments && leadingDetachedComments.length > 0) {
    const lines = leadingDetachedComments[0].split(/\r?\n/).filter(line => line);
    const backendServices = lines
      .find(line => line.startsWith('backend-services='))
      ?.split('=')[1]
      .split(',');
    const frontendServices = lines
      .find(line => line.startsWith('frontend-services='))
      ?.split('=')[1]
      .split(',');
    return {
      backendServices: Object.keys(services)
        .filter(key => backendServices?.find(service => service === key))
        .map(key => services[key]),
      frontendServices: Object.keys(services)
        .filter(key => frontendServices?.find(service => service === key))
        .map(key => services[key]),
    };
  } else {
    return {
      backendServices: [],
      frontendServices: [],
    };
  }
}

export async function generateFiles(
  fileDescriptorProtos: FileDescriptorProto[],
  servicesFile: string,
  protosDir: string,
): Promise<GeneratedFile[]> {
  const services = loadServices(servicesFile);
  const typeMap = generateTypeMap(fileDescriptorProtos);
  const typesFrontendBackendFiles = Promise.all(
    fileDescriptorProtos.flatMap(fileDescriptorProto => {
      const { backendServices, frontendServices } = determineServices(services, fileDescriptorProto);
      const allServices = [backendServices, frontendServices].flat();
      return [
        ...allServices.map(service => generateTypesContent(service, fileDescriptorProto, typeMap)),
        ...backendServices.map(service => generateBackendContent(service, protosDir, fileDescriptorProto, typeMap)),
        ...frontendServices.map(service => generateFrontendContent(service, protosDir, fileDescriptorProto, typeMap)),
      ];
    }),
  );
  const backendMicroserviceOptionsFiles = Promise.all(
    generateBackendMicroserviceOptionsFiles(services, fileDescriptorProtos),
  );
  return [...(await typesFrontendBackendFiles).flat(), ...(await backendMicroserviceOptionsFiles)];
}
