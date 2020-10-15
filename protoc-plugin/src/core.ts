import { appendFileSync, existsSync, readFileSync } from 'fs';
import { google } from 'ts-proto/build/pbjs';
import {mkdirs} from './utils';
import FileDescriptorProto = google.protobuf.FileDescriptorProto;

export const LOG = './log.txt';

export function log(str: unknown) {
  appendFileSync(LOG, Buffer.from(`${JSON.stringify(str)}\n`));
}

export function prefixDisableLinter(fileContents: string): string {
  return `/* eslint-disable */
${fileContents}`;
}

export class Service {
  readonly generatedDir: string;
  readonly protosDir: string;

  constructor(private readonly rootDir: string) {
    this.generatedDir = `${this.rootDir}/generated/`;
    this.protosDir = `${this.rootDir}/protos/`;
    if (!existsSync(this.generatedDir)) {
      mkdirs(this.generatedDir);
    }
    if (!existsSync(this.protosDir)) {
      mkdirs(this.protosDir);
    }
  }
}

export interface Services {
  [key: string]: Service;
}

export function loadServices(): Services {
  const data = JSON.parse(readFileSync('services.json', { encoding: 'utf-8' })) as { [s: string]: { rootDir: string } };
  const services = {} as Services;
  for (const [key, value] of Object.entries(data)) {
    services[key] = Object.assign(new Service(value.rootDir));
  }
  return services;
}

export function determineServices(
  fileDescriptorProto: FileDescriptorProto,
): { backendServices: Service[]; frontendServices: Service[] } {
  const services = loadServices();
  const leadingDetachedComments =
    fileDescriptorProto.sourceCodeInfo?.location?.flatMap(location => location.leadingDetachedComments) ?? [];
  if (leadingDetachedComments.length > 0) {
    const lines = leadingDetachedComments[0].split(/\r?\n/).filter(line => !!line);
    const backendServices =
      lines
        .find(line => line.startsWith('backend-services='))
        ?.split('=')?.[1]
        ?.split(',') ?? [];
    const frontendServices =
      lines
        .find(line => line.startsWith('frontend-services='))
        ?.split('=')?.[1]
        ?.split(',') ?? [];
    return {
      backendServices: Object.keys(services)
        .filter(key => backendServices.find(service => service === key))
        .map(key => services[key]),
      frontendServices: Object.keys(services)
        .filter(key => frontendServices.find(service => service === key))
        .map(key => services[key]),
    };
  } else {
    return {
      backendServices: [],
      frontendServices: [],
    };
  }
}
