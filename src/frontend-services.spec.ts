import { FileDescriptorProto, ServiceDescriptorProto } from '@protobuf-ts/plugin-framework';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { util } from 'protobufjs';
import { BASE_TEST_DIR, trimPadding } from '../test/utils';
import { Service } from './core';
import { generateFrontendContent } from './frontend-services';
import { TypeMap } from './types';
import normalize = util.path.normalize;

describe('frontend-services', () => {
  const rootTestDir = join(BASE_TEST_DIR, 'frontend-services');

  beforeAll(() => {
    mkdirSync(rootTestDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(rootTestDir, { recursive: true, force: true });
  });

  describe('generateFrontendContent', () => {
    const testDir = join(rootTestDir, 'generateFrontendContent');
    const protosDir = join(testDir, 'protos');
    const protoFileName = 'foo.proto';
    const typeMap: TypeMap = new Map([
      ['.Foo', { type: 'Foo', relativePath: 'foo/Foo' }],
      ['.Bar', { type: 'Bar', relativePath: 'bar/Bar' }],
    ]);

    beforeEach(() => {
      mkdirSync(protosDir, { recursive: true });
      writeFileSync(join(protosDir, protoFileName), Buffer.from('syntax = "proto2";', 'utf-8'));
    });

    afterEach(() => {
      rmSync(testDir, { recursive: true, force: true });
    });

    it('should generate the correct content when a single service is defined', async () => {
      const service = new Service(join(testDir, 'foo'));
      const fileDescriptorProto = FileDescriptorProto.create({
        name: 'foo.proto',
        package: 'foo',
        service: [
          ServiceDescriptorProto.create({
            name: 'Bar',
            method: [
              {
                name: 'bar1',
                inputType: '.Foo',
                outputType: '.Bar',
              },
            ],
          }),
        ],
      });

      const result = await generateFrontendContent(service, protosDir, fileDescriptorProto, typeMap);
      const filePath = result.getFilename();
      const content = result.getContent().trim();

      const expectedFilePath = normalize(join(service.generatedDir, 'foo', 'foo.frontend.ts'));
      const expectedContent = trimPadding(`
        /* eslint-disable */
        import { ClientProviderOptions, Transport } from '@nestjs/microservices';
        import { Foo } from '../foo/Foo';
        import { Bar } from '../bar/Bar';
        import { Observable } from 'rxjs';

        export const BarClientProviderOptions: ClientProviderOptions = {
          name: 'Bar',
          transport: Transport.GRPC,
          options: {
            package: 'foo',
            protoPath: '../protos/foo.proto',
          },
        };

        export interface BarClient {
          bar1(request: Foo): Bar | Promise<Bar> | Observable<Bar>;
        }
      `).trim();

      expect(filePath).toEqual(expectedFilePath);
      expect(content).toEqual(expectedContent);
    });

    it('should generate the correct content when a service contains multiple methods', async () => {
      const service = new Service(join(testDir, 'foo'));
      const fileDescriptorProto = FileDescriptorProto.create({
        name: 'foo.proto',
        package: 'foo',
        service: [
          ServiceDescriptorProto.create({
            name: 'Bar',
            method: [
              {
                name: 'bar1',
                inputType: '.Foo',
                outputType: '.Bar',
              },
              {
                name: 'bar2',
                inputType: '.Bar',
                outputType: '.Foo',
              },
            ],
          }),
        ],
      });

      const result = await generateFrontendContent(service, protosDir, fileDescriptorProto, typeMap);
      const filePath = result.getFilename();
      const content = result.getContent().trim();

      const expectedFilePath = normalize(join(service.generatedDir, 'foo', 'foo.frontend.ts'));
      const expectedContent = trimPadding(`
        /* eslint-disable */
        import { ClientProviderOptions, Transport } from '@nestjs/microservices';
        import { Bar } from '../bar/Bar';
        import { Foo } from '../foo/Foo';
        import { Observable } from 'rxjs';

        export const BarClientProviderOptions: ClientProviderOptions = {
          name: 'Bar',
          transport: Transport.GRPC,
          options: {
            package: 'foo',
            protoPath: '../protos/foo.proto',
          },
        };

        export interface BarClient {
          bar1(request: Foo): Bar | Promise<Bar> | Observable<Bar>;
          bar2(request: Bar): Foo | Promise<Foo> | Observable<Foo>;
        }
      `).trim();

      expect(filePath).toEqual(expectedFilePath);
      expect(content).toEqual(expectedContent);
    });

    it('should generate the correct content when multiple services are defined', async () => {
      const service = new Service(join(testDir, 'foo'));
      const fileDescriptorProto = FileDescriptorProto.create({
        name: 'foo.proto',
        package: 'foo',
        service: [
          ServiceDescriptorProto.create({
            name: 'Bar',
            method: [
              {
                name: 'bar1',
                inputType: '.Foo',
                outputType: '.Bar',
              },
            ],
          }),
          ServiceDescriptorProto.create({
            name: 'Baz',
            method: [
              {
                name: 'baz1',
                inputType: '.Foo',
                outputType: '.Bar',
              },
            ],
          }),
        ],
      });

      const result = await generateFrontendContent(service, protosDir, fileDescriptorProto, typeMap);
      const filePath = result.getFilename();
      const content = result.getContent().trim();

      const expectedFilePath = normalize(join(service.generatedDir, 'foo', 'foo.frontend.ts'));
      const expectedContent = trimPadding(`
        /* eslint-disable */
        import { ClientProviderOptions, Transport } from '@nestjs/microservices';
        import { Foo } from '../foo/Foo';
        import { Bar } from '../bar/Bar';
        import { Observable } from 'rxjs';

        export const BarClientProviderOptions: ClientProviderOptions = {
          name: 'Bar',
          transport: Transport.GRPC,
          options: {
            package: 'foo',
            protoPath: '../protos/foo.proto',
          },
        };

        export interface BarClient {
          bar1(request: Foo): Bar | Promise<Bar> | Observable<Bar>;
        }

        export const BazClientProviderOptions: ClientProviderOptions = {
          name: 'Baz',
          transport: Transport.GRPC,
          options: {
            package: 'foo',
            protoPath: '../protos/foo.proto',
          },
        };

        export interface BazClient {
          baz1(request: Foo): Bar | Promise<Bar> | Observable<Bar>;
        }
      `).trim();

      expect(filePath).toEqual(expectedFilePath);
      expect(content).toEqual(expectedContent);
    });
  });
});
