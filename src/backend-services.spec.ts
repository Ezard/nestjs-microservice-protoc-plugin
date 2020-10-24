import { rmdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { google } from 'ts-proto/build/pbjs';
import { trimPadding } from '../test/utils';
import { generateBackendContent, generateBackendMicroserviceOptionsFiles } from './backend-services';
import { Service, Services } from './core';
import { TypeMap } from './types';
import { mkdirs } from './utils';
import FileDescriptorProto = google.protobuf.FileDescriptorProto;
import MethodDescriptorProto = google.protobuf.MethodDescriptorProto;
import ServiceDescriptorProto = google.protobuf.ServiceDescriptorProto;
import SourceCodeInfo = google.protobuf.SourceCodeInfo;
import Location = google.protobuf.SourceCodeInfo.Location;

describe('backend-services', () => {
  describe('generateBackendContent', () => {
    const rootDir = './generateBackendContent-test';
    const service = new Service(rootDir);
    const protosDir = './generateBackendContent-protos';
    const protoFileName = './foo.proto';
    const typeMap: TypeMap = new Map([
      ['.Bar', { type: 'Bar', relativePath: 'bar/Bar' }],
      ['.Baz', { type: 'Baz', relativePath: 'baz/Baz' }],
    ]);

    beforeAll(() => {
      mkdirs(protosDir);
      writeFileSync(join(protosDir, protoFileName), Buffer.from('syntax = "proto2";', 'utf-8'));
    });

    afterAll(() => {
      rmdirSync(rootDir, { recursive: true });
      rmdirSync(protosDir, { recursive: true });
    });

    it('should emit the correct output when there are no services', async () => {
      const fileDescriptorProto = new FileDescriptorProto({
        name: protoFileName,
        service: [],
      });

      const result = await generateBackendContent(service, protosDir, fileDescriptorProto, typeMap);
      const trimmedResult = result.content.trim();

      const expected = trimPadding(`
        /* eslint-disable */
      `).trim();

      expect(trimmedResult).toEqual(expected);
    });

    it('should emit the correct output when there is one service', async () => {
      const fileDescriptorProto = new FileDescriptorProto({
        name: protoFileName,
        service: [
          new ServiceDescriptorProto({
            name: 'Foo',
            method: [
              new MethodDescriptorProto({
                name: 'foo',
                inputType: '.Bar',
                outputType: '.Baz',
              }),
            ],
          }),
        ],
      });

      const result = await generateBackendContent(service, protosDir, fileDescriptorProto, typeMap);
      const trimmedResult = result.content.trim();

      const expected = trimPadding(`
        /* eslint-disable */
        import { GrpcMethod } from '@nestjs/microservices';
        import { Bar } from './bar/Bar';
        import { Baz } from './baz/Baz';
        import { Observable } from 'rxjs';

        export interface FooController {
          foo(request: Bar): Baz | Promise<Baz> | Observable<Baz>;
        }

        export function FooControllerMethods() {
          return function (constructor: Function) {
            const grpcMethods: string[] = ['foo'];
            for (const method of grpcMethods) {
              const descriptor: any = Reflect.getOwnPropertyDescriptor(constructor.prototype, method);
              GrpcMethod('Foo', method)(constructor.prototype[method], method, descriptor);
            }
          };
        }
      `).trim();

      expect(trimmedResult).toEqual(expected);
    });

    it('should emit the correct output when there is more than one service', async () => {
      const fileDescriptorProto = new FileDescriptorProto({
        name: protoFileName,
        service: [
          new ServiceDescriptorProto({
            name: 'Foo',
            method: [
              new MethodDescriptorProto({
                name: 'foo',
                inputType: '.Bar',
                outputType: '.Baz',
              }),
            ],
          }),
          new ServiceDescriptorProto({
            name: 'Foo2',
            method: [
              new MethodDescriptorProto({
                name: 'foo',
                inputType: '.Bar',
                outputType: '.Baz',
              }),
            ],
          }),
        ],
      });

      const result = await generateBackendContent(service, protosDir, fileDescriptorProto, typeMap);
      const trimmedResult = result.content.trim();

      const expected = trimPadding(`
        /* eslint-disable */
        import { GrpcMethod } from '@nestjs/microservices';
        import { Bar } from './bar/Bar';
        import { Baz } from './baz/Baz';
        import { Observable } from 'rxjs';

        export interface FooController {
          foo(request: Bar): Baz | Promise<Baz> | Observable<Baz>;
        }

        export function FooControllerMethods() {
          return function (constructor: Function) {
            const grpcMethods: string[] = ['foo'];
            for (const method of grpcMethods) {
              const descriptor: any = Reflect.getOwnPropertyDescriptor(constructor.prototype, method);
              GrpcMethod('Foo', method)(constructor.prototype[method], method, descriptor);
            }
          };
        }

        export interface Foo2Controller {
          foo(request: Bar): Baz | Promise<Baz> | Observable<Baz>;
        }

        export function Foo2ControllerMethods() {
          return function (constructor: Function) {
            const grpcMethods: string[] = ['foo'];
            for (const method of grpcMethods) {
              const descriptor: any = Reflect.getOwnPropertyDescriptor(constructor.prototype, method);
              GrpcMethod('Foo2', method)(constructor.prototype[method], method, descriptor);
            }
          };
        }
      `).trim();

      expect(trimmedResult).toEqual(expected);
    });

    it('should emit the correct output when the service has multiple methods', async () => {
      const fileDescriptorProto = new FileDescriptorProto({
        name: protoFileName,
        service: [
          new ServiceDescriptorProto({
            name: 'Foo',
            method: [
              new MethodDescriptorProto({
                name: 'foo1',
                inputType: '.Bar',
                outputType: '.Baz',
              }),
              new MethodDescriptorProto({
                name: 'foo2',
                inputType: '.Baz',
                outputType: '.Bar',
              }),
            ],
          }),
        ],
      });

      const result = await generateBackendContent(service, protosDir, fileDescriptorProto, typeMap);
      const trimmedResult = result.content.trim();

      const expected = trimPadding(`
        /* eslint-disable */
        import { GrpcMethod } from '@nestjs/microservices';
        import { Baz } from './baz/Baz';
        import { Bar } from './bar/Bar';
        import { Observable } from 'rxjs';

        export interface FooController {
          foo1(request: Bar): Baz | Promise<Baz> | Observable<Baz>;
          foo2(request: Baz): Bar | Promise<Bar> | Observable<Bar>;
        }

        export function FooControllerMethods() {
          return function (constructor: Function) {
            const grpcMethods: string[] = ['foo1', 'foo2'];
            for (const method of grpcMethods) {
              const descriptor: any = Reflect.getOwnPropertyDescriptor(constructor.prototype, method);
              GrpcMethod('Foo', method)(constructor.prototype[method], method, descriptor);
            }
          };
        }
      `).trim();

      expect(trimmedResult).toEqual(expected);
    });

    it('should emit the correct output when a service has no methods', async () => {
      const fileDescriptorProto = new FileDescriptorProto({
        name: protoFileName,
        service: [
          new ServiceDescriptorProto({
            name: 'Foo',
          }),
        ],
      });

      const result = await generateBackendContent(service, protosDir, fileDescriptorProto, typeMap);
      const trimmedResult = result.content.trim();

      const expected = trimPadding(`
        /* eslint-disable */
        export interface FooController {}

        export function FooControllerMethods() {
          return function (constructor: Function) {};
        }
      `).trim();

      expect(trimmedResult).toEqual(expected);
    });
  });
  describe('generateBackendMicroserviceOptionsFiles', () => {
    afterAll(() => {
      rmdirSync('./foo/generated');
      rmdirSync('./foo/protos');
      rmdirSync('./foo');
    });

    it('should emit the correct output when a single file is provided', async () => {
      const services: Services = {
        foo: new Service('./foo'),
      };
      const fileDescriptorProtos = [
        new FileDescriptorProto({
          name: './foo/foo.proto',
          package: 'foo',
          sourceCodeInfo: new SourceCodeInfo({
            location: [
              new Location({
                leadingDetachedComments: ['backend-services=foo'],
              }),
            ],
          }),
        }),
      ];

      const files = await Promise.all(generateBackendMicroserviceOptionsFiles(services, fileDescriptorProtos));
      const result = files[0].content.trim();

      const expected = trimPadding(`
        /* eslint-disable */
        import { GrpcOptions, Transport } from '@nestjs/microservices';

        export function getBackendMicroserviceOptions(url: string): GrpcOptions {
          return {
            transport: Transport.GRPC,
            options: {
              package: ['foo'],
              protoPath: ['../protos/foo/foo.proto'],
              url,
            },
          };
        }
      `).trim();

      expect(result).toEqual(expected);
    });

    it('should emit the correct output when a multiple files in the same package are provided', async () => {
      const services: Services = {
        foo: new Service('./foo'),
      };
      const fileDescriptorProtos = [
        new FileDescriptorProto({
          name: './foo/foo.proto',
          package: 'foo',
          sourceCodeInfo: new SourceCodeInfo({
            location: [
              new Location({
                leadingDetachedComments: ['backend-services=foo'],
              }),
            ],
          }),
        }),
        new FileDescriptorProto({
          name: './foo/bar.proto',
          package: 'foo',
          sourceCodeInfo: new SourceCodeInfo({
            location: [
              new Location({
                leadingDetachedComments: ['backend-services=foo'],
              }),
            ],
          }),
        }),
      ];

      const files = await Promise.all(generateBackendMicroserviceOptionsFiles(services, fileDescriptorProtos));
      const result = files[0].content.trim();

      const expected = trimPadding(`
        /* eslint-disable */
        import { GrpcOptions, Transport } from '@nestjs/microservices';

        export function getBackendMicroserviceOptions(url: string): GrpcOptions {
          return {
            transport: Transport.GRPC,
            options: {
              package: ['foo'],
              protoPath: ['../protos/foo/foo.proto', '../protos/foo/bar.proto'],
              url,
            },
          };
        }
      `).trim();

      expect(result).toEqual(expected);
    });

    it('should emit the correct output when a multiple files in different packages are provided', async () => {
      const services: Services = {
        foo: new Service('./foo'),
      };
      const fileDescriptorProtos = [
        new FileDescriptorProto({
          name: './foo/foo.proto',
          package: 'foo',
          sourceCodeInfo: new SourceCodeInfo({
            location: [
              new Location({
                leadingDetachedComments: ['backend-services=foo'],
              }),
            ],
          }),
        }),
        new FileDescriptorProto({
          name: './bar/bar.proto',
          package: 'bar',
          sourceCodeInfo: new SourceCodeInfo({
            location: [
              new Location({
                leadingDetachedComments: ['backend-services=foo'],
              }),
            ],
          }),
        }),
      ];

      const files = await Promise.all(generateBackendMicroserviceOptionsFiles(services, fileDescriptorProtos));
      const result = files[0].content.trim();

      const expected = trimPadding(`
        /* eslint-disable */
        import { GrpcOptions, Transport } from '@nestjs/microservices';

        export function getBackendMicroserviceOptions(url: string): GrpcOptions {
          return {
            transport: Transport.GRPC,
            options: {
              package: ['foo', 'bar'],
              protoPath: ['../protos/foo/foo.proto', '../protos/bar/bar.proto'],
              url,
            },
          };
        }
      `).trim();

      expect(result).toEqual(expected);
    });

    it('should emit the correct output when a multiple backend services are defined', async () => {
      const services: Services = {
        foo: new Service('./foo'),
        bar: new Service('./bar'),
      };
      const fileDescriptorProtos = [
        new FileDescriptorProto({
          name: './foo/foo.proto',
          package: 'foo',
          sourceCodeInfo: new SourceCodeInfo({
            location: [
              new Location({
                leadingDetachedComments: ['backend-services=foo,bar'],
              }),
            ],
          }),
        }),
      ];

      const files = await Promise.all(generateBackendMicroserviceOptionsFiles(services, fileDescriptorProtos));
      const result1 = files[0].content.trim();
      const result2 = files[1].content.trim();

      const expected1 = trimPadding(`
        /* eslint-disable */
        import { GrpcOptions, Transport } from '@nestjs/microservices';

        export function getBackendMicroserviceOptions(url: string): GrpcOptions {
          return {
            transport: Transport.GRPC,
            options: {
              package: ['foo'],
              protoPath: ['../protos/foo/foo.proto'],
              url,
            },
          };
        }
      `).trim();
      const expected2 = trimPadding(`
        /* eslint-disable */
        import { GrpcOptions, Transport } from '@nestjs/microservices';

        export function getBackendMicroserviceOptions(url: string): GrpcOptions {
          return {
            transport: Transport.GRPC,
            options: {
              package: ['foo'],
              protoPath: ['../protos/foo/foo.proto'],
              url,
            },
          };
        }
      `).trim();

      expect(result1).toEqual(expected1);
      expect(result2).toEqual(expected2);
    });

    it('should not emit anything for frontend services', async () => {
      const services: Services = {
        foo: new Service('./foo'),
      };
      const fileDescriptorProtos = [
        new FileDescriptorProto({
          name: './foo/foo.proto',
          package: 'foo',
          sourceCodeInfo: new SourceCodeInfo({
            location: [
              new Location({
                leadingDetachedComments: ['frontend-services=foo'],
              }),
            ],
          }),
        }),
      ];

      const files = await Promise.all(generateBackendMicroserviceOptionsFiles(services, fileDescriptorProtos));
      const numFiles = files.length;

      expect(numFiles).toEqual(0);
    });
  });
});
