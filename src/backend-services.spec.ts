import {
  FileDescriptorProto,
  ServiceDescriptorProto,
  SourceCodeInfo,
  SourceCodeInfo_Location,
} from '@protobuf-ts/plugin-framework';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { BASE_TEST_DIR, trimPadding } from '../test/utils';
import { generateBackendContent, generateBackendMicroserviceOptionsFiles } from './backend-services';
import { Service, Services } from './core';
import { TypeMap } from './types';

describe('backend-services', () => {
  const rootTestDir = join(BASE_TEST_DIR, 'backend-services');

  beforeAll(() => {
    mkdirSync(rootTestDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(rootTestDir, { recursive: true, force: true });
  });

  describe('generateBackendContent', () => {
    const testDir = join(rootTestDir, 'generateBackendContent');
    const protosDir = join(testDir, 'protos');
    const protoFileName = 'foo.proto';
    const typeMap: TypeMap = new Map([
      ['.Bar', { type: 'Bar', relativePath: 'bar/Bar' }],
      ['.Baz', { type: 'Baz', relativePath: 'baz/Baz' }],
    ]);

    beforeEach(() => {
      mkdirSync(protosDir, { recursive: true });
      writeFileSync(join(protosDir, protoFileName), Buffer.from('syntax = "proto2";', 'utf-8'));
    });

    afterEach(() => {
      rmSync(testDir, { recursive: true, force: true });
    });

    it('should emit the correct output when there are no services', async () => {
      const service = new Service(join(testDir, 'foo'));
      const fileDescriptorProto = FileDescriptorProto.create({
        package: '',
        name: protoFileName,
      });

      const result = await generateBackendContent(service, protosDir, fileDescriptorProto, typeMap);
      const trimmedResult = result.getContent().trim();

      const expected = trimPadding(`
        /* eslint-disable */
      `).trim();

      expect(trimmedResult).toEqual(expected);
    });

    it('should emit the correct output when there is one service', async () => {
      const service = new Service(join(testDir, 'foo'));
      const fileDescriptorProto = FileDescriptorProto.create({
        package: '',
        name: protoFileName,
        service: [
          ServiceDescriptorProto.create({
            name: 'Foo',
            method: [
              {
                name: 'foo',
                inputType: '.Bar',
                outputType: '.Baz',
              },
            ],
          }),
        ],
      });

      const result = await generateBackendContent(service, protosDir, fileDescriptorProto, typeMap);
      const trimmedResult = result.getContent().trim();

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
      const service = new Service(join(testDir, 'foo'));
      const fileDescriptorProto = FileDescriptorProto.create({
        package: '',
        name: protoFileName,
        service: [
          ServiceDescriptorProto.create({
            name: 'Foo',
            method: [
              {
                name: 'foo',
                inputType: '.Bar',
                outputType: '.Baz',
              },
            ],
          }),
          ServiceDescriptorProto.create({
            name: 'Foo2',
            method: [
              {
                name: 'foo',
                inputType: '.Bar',
                outputType: '.Baz',
              },
            ],
          }),
        ],
      });

      const result = await generateBackendContent(service, protosDir, fileDescriptorProto, typeMap);
      const trimmedResult = result.getContent().trim();

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
      const service = new Service(join(testDir, 'foo'));
      const fileDescriptorProto = FileDescriptorProto.create({
        package: '',
        name: protoFileName,
        service: [
          ServiceDescriptorProto.create({
            name: 'Foo',
            method: [
              {
                name: 'foo1',
                inputType: '.Bar',
                outputType: '.Baz',
              },
              {
                name: 'foo2',
                inputType: '.Baz',
                outputType: '.Bar',
              },
            ],
          }),
        ],
      });

      const result = await generateBackendContent(service, protosDir, fileDescriptorProto, typeMap);
      const trimmedResult = result.getContent().trim();

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
      const service = new Service(join(testDir, 'foo'));
      const fileDescriptorProto = FileDescriptorProto.create({
        package: '',
        name: protoFileName,
        service: [
          ServiceDescriptorProto.create({
            name: 'Foo',
          }),
        ],
      });

      const result = await generateBackendContent(service, protosDir, fileDescriptorProto, typeMap);
      const trimmedResult = result.getContent().trim();

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
    const testDir = join(rootTestDir, 'generateBackendMicroserviceOptionsFiles');

    beforeEach(() => {
      mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
      rmSync(testDir, { recursive: true, force: true });
    });

    it('should emit the correct output when a single file is provided', async () => {
      const services: Services = {
        foo: new Service(join(testDir, 'foo')),
      };
      const fileDescriptorProtos = [
        FileDescriptorProto.create({
          name: './foo/foo.proto',
          package: 'foo',
          sourceCodeInfo: SourceCodeInfo.create({
            location: [
              SourceCodeInfo_Location.create({
                leadingDetachedComments: ['backend-services=foo'],
              }),
            ],
          }),
        }),
      ];

      const files = await Promise.all(generateBackendMicroserviceOptionsFiles(services, fileDescriptorProtos));
      const result = files[0].getContent().trim();

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
        foo: new Service(join(testDir, 'foo')),
      };
      const fileDescriptorProtos = [
        FileDescriptorProto.create({
          name: './foo/foo.proto',
          package: 'foo',
          sourceCodeInfo: SourceCodeInfo.create({
            location: [
              SourceCodeInfo_Location.create({
                leadingDetachedComments: ['backend-services=foo'],
              }),
            ],
          }),
        }),
        FileDescriptorProto.create({
          name: './foo/bar.proto',
          package: 'foo',
          sourceCodeInfo: SourceCodeInfo.create({
            location: [
              SourceCodeInfo_Location.create({
                leadingDetachedComments: ['backend-services=foo'],
              }),
            ],
          }),
        }),
      ];

      const files = await Promise.all(generateBackendMicroserviceOptionsFiles(services, fileDescriptorProtos));
      const result = files[0].getContent().trim();

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
        foo: new Service(join(testDir, 'foo')),
      };
      const fileDescriptorProtos = [
        FileDescriptorProto.create({
          name: './foo/foo.proto',
          package: 'foo',
          sourceCodeInfo: SourceCodeInfo.create({
            location: [
              SourceCodeInfo_Location.create({
                leadingDetachedComments: ['backend-services=foo'],
              }),
            ],
          }),
        }),
        FileDescriptorProto.create({
          name: './bar/bar.proto',
          package: 'bar',
          sourceCodeInfo: SourceCodeInfo.create({
            location: [
              SourceCodeInfo_Location.create({
                leadingDetachedComments: ['backend-services=foo'],
              }),
            ],
          }),
        }),
      ];

      const files = await Promise.all(generateBackendMicroserviceOptionsFiles(services, fileDescriptorProtos));
      const result = files[0].getContent().trim();

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
        foo: new Service(join(testDir, 'foo')),
        bar: new Service(join(testDir, 'bar')),
      };
      const fileDescriptorProtos = [
        FileDescriptorProto.create({
          name: './foo/foo.proto',
          package: 'foo',
          sourceCodeInfo: SourceCodeInfo.create({
            location: [
              SourceCodeInfo_Location.create({
                leadingDetachedComments: ['backend-services=foo,bar'],
              }),
            ],
          }),
        }),
      ];

      const files = await Promise.all(generateBackendMicroserviceOptionsFiles(services, fileDescriptorProtos));
      const result1 = files[0].getContent().trim();
      const result2 = files[1].getContent().trim();

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

    it('should emit the correct output when a single file with multiple package levels is provided', async () => {
      const services: Services = {
        foo: new Service(join(testDir, 'foo')),
      };
      const fileDescriptorProtos = [
        FileDescriptorProto.create({
          name: './foo/bar/foo.proto',
          package: 'foo.bar',
          sourceCodeInfo: {
            location: [
              SourceCodeInfo_Location.create({
                leadingDetachedComments: ['backend-services=foo'],
              }),
            ],
          },
        }),
      ];

      const files = await Promise.all(generateBackendMicroserviceOptionsFiles(services, fileDescriptorProtos));
      const result = files[0].getContent().trim();

      const expected = trimPadding(`
        /* eslint-disable */
        import { GrpcOptions, Transport } from '@nestjs/microservices';

        export function getBackendMicroserviceOptions(url: string): GrpcOptions {
          return {
            transport: Transport.GRPC,
            options: {
              package: ['foo.bar'],
              protoPath: ['../protos/foo/bar/foo.proto'],
              url,
            },
          };
        }
      `).trim();

      expect(result).toEqual(expected);
    });

    it('should not emit anything for frontend services', async () => {
      const services: Services = {
        foo: new Service(join(testDir, 'foo')),
      };
      const fileDescriptorProtos = [
        FileDescriptorProto.create({
          name: './foo/foo.proto',
          package: 'foo',
          sourceCodeInfo: {
            location: [
              SourceCodeInfo_Location.create({
                leadingDetachedComments: ['frontend-services=foo'],
              }),
            ],
          },
        }),
      ];

      const files = await Promise.all(generateBackendMicroserviceOptionsFiles(services, fileDescriptorProtos));
      const numFiles = files.length;

      expect(numFiles).toEqual(0);
    });
  });
});
