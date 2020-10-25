import { mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { google } from 'ts-proto/build/pbjs';
import FileDescriptorProto = google.protobuf.FileDescriptorProto;

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
  const leadingDetachedComments = fileDescriptorProto.sourceCodeInfo?.location?.flatMap(
    location => location.leadingDetachedComments,
  );
  if (leadingDetachedComments && leadingDetachedComments.length > 0) {
    const lines = leadingDetachedComments[0].split(/\r?\n/).filter(line => line);
    const backendServices = lines
      .find(line => line.startsWith('backend-services='))
      ?.split('=')?.[1]
      ?.split(',');
    const frontendServices = lines
      .find(line => line.startsWith('frontend-services='))
      ?.split('=')?.[1]
      ?.split(',');
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
