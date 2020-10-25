import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { google } from 'ts-proto/build/pbjs';
import { BASE_TEST_DIR } from '../test/utils';
import { determineServices, loadServices, Service, Services } from './core';
import FileDescriptorProto = google.protobuf.FileDescriptorProto;
import SourceCodeInfo = google.protobuf.SourceCodeInfo;
import Location = google.protobuf.SourceCodeInfo.Location;

describe('core', () => {
  const rootTestDir = join(BASE_TEST_DIR, 'core');

  describe('Service', () => {
    const testDir = join(rootTestDir, 'Service');
    const serviceRootDir = join(testDir, 'foo');
    const protosDir = join(serviceRootDir, 'protos');
    const generatedDir = join(serviceRootDir, 'generated');

    beforeEach(() => {
      mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
      rmSync(testDir, { recursive: true, force: true });
    });

    it('should calculate protos dir from root dir', () => {
      const service = new Service(serviceRootDir);

      expect(service.protosDir).toEqual(protosDir);
    });

    it('should calculate generated dir from root dir', () => {
      const service = new Service(serviceRootDir);

      expect(service.generatedDir).toEqual(generatedDir);
    });

    it("should create the protos dir if it doesn't exist", () => {
      const service = new Service(serviceRootDir);

      const dirExists = existsSync(service.protosDir);
      expect(dirExists).toBe(true);
    });

    it("should create the generated dir if it doesn't exist", () => {
      const service = new Service(serviceRootDir);

      const dirExists = existsSync(service.generatedDir);
      expect(dirExists).toBe(true);
    });
  });

  describe('loadServices', () => {
    const testDir = join(rootTestDir, 'loadServices');
    const fooServiceRootDir = join(testDir, 'foo');
    const barServiceRootDir = join(testDir, 'bar');

    beforeEach(() => {
      mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
      rmSync(testDir, { recursive: true, force: true });
    });

    it('should load the services in the JSON file', () => {
      const filePath = join(testDir, 'loadServices-test-services.json');
      const services = {
        foo: {
          rootDir: fooServiceRootDir,
        },
        bar: {
          rootDir: barServiceRootDir,
        },
      };
      writeFileSync(filePath, JSON.stringify(services));

      const result = loadServices(filePath);

      expect(result['foo']).toBeDefined();
      expect(result['foo'].protosDir).toEqual(join(fooServiceRootDir, 'protos'));
      expect(result['bar']).toBeDefined();
      expect(result['bar'].generatedDir).toEqual(join(barServiceRootDir, 'generated'));
    });
  });

  describe('determineServices', () => {
    const testDir = join(rootTestDir, 'determineServices');
    const services: Services = {
      fooBackend: new Service(join(testDir, 'fooBackend')),
      fooFrontend: new Service(join(testDir, 'fooFrontend')),
      barBackend: new Service(join(testDir, 'barBackend')),
      barFrontend: new Service(join(testDir, 'barFrontend')),
    };

    beforeEach(() => {
      mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
      rmSync(testDir, { recursive: true, force: true });
    });

    it('should parse a single backend service', () => {
      const fileDescriptorProto = new FileDescriptorProto({
        sourceCodeInfo: new SourceCodeInfo({
          location: [
            new Location({
              leadingDetachedComments: ['backend-services=fooBackend'],
            }),
          ],
        }),
      });

      const result = determineServices(services, fileDescriptorProto);
      const fooBackendDetermined = result.backendServices.includes(services['fooBackend']);

      expect(fooBackendDetermined).toEqual(true);
    });
    it('should parse multiple backend services', () => {
      const fileDescriptorProto = new FileDescriptorProto({
        sourceCodeInfo: new SourceCodeInfo({
          location: [
            new Location({
              leadingDetachedComments: ['backend-services=fooBackend,barBackend'],
            }),
          ],
        }),
      });

      const result = determineServices(services, fileDescriptorProto);
      const fooBackendDetermined = result.backendServices.includes(services['fooBackend']);
      const barBackendDetermined = result.backendServices.includes(services['barBackend']);

      expect(fooBackendDetermined).toEqual(true);
      expect(barBackendDetermined).toEqual(true);
    });
    it('should parse a single frontend service', () => {
      const fileDescriptorProto = new FileDescriptorProto({
        sourceCodeInfo: new SourceCodeInfo({
          location: [
            new Location({
              leadingDetachedComments: ['frontend-services=fooFrontend'],
            }),
          ],
        }),
      });

      const result = determineServices(services, fileDescriptorProto);
      const fooFrontendDetermined = result.frontendServices.includes(services['fooFrontend']);

      expect(fooFrontendDetermined).toEqual(true);
    });
    it('should parse multiple frontend services', () => {
      const fileDescriptorProto = new FileDescriptorProto({
        sourceCodeInfo: new SourceCodeInfo({
          location: [
            new Location({
              leadingDetachedComments: ['frontend-services=fooFrontend,barFrontend'],
            }),
          ],
        }),
      });

      const result = determineServices(services, fileDescriptorProto);
      const fooFrontendDetermined = result.frontendServices.includes(services['fooFrontend']);
      const barFrontendDetermined = result.frontendServices.includes(services['barFrontend']);

      expect(fooFrontendDetermined).toEqual(true);
      expect(barFrontendDetermined).toEqual(true);
    });
    it('should parse multiple backend services and multiple frontend services', () => {
      const fileDescriptorProto = new FileDescriptorProto({
        sourceCodeInfo: new SourceCodeInfo({
          location: [
            new Location({
              leadingDetachedComments: [
                `backend-services=fooBackend,barBackend\nfrontend-services=fooFrontend,barFrontend`,
              ],
            }),
          ],
        }),
      });

      const result = determineServices(services, fileDescriptorProto);
      const fooBackendDetermined = result.backendServices.includes(services['fooBackend']);
      const barBackendDetermined = result.backendServices.includes(services['barBackend']);
      const fooFrontendDetermined = result.frontendServices.includes(services['fooFrontend']);
      const barFrontendDetermined = result.frontendServices.includes(services['barFrontend']);

      expect(fooBackendDetermined).toEqual(true);
      expect(barBackendDetermined).toEqual(true);
      expect(fooFrontendDetermined).toEqual(true);
      expect(barFrontendDetermined).toEqual(true);
    });
    it('should return empty arrays when no services are parsed due to lack of leading detached comments', () => {
      const fileDescriptorProto = new FileDescriptorProto();

      const result = determineServices(services, fileDescriptorProto);
      const numBackendServices = result.backendServices.length;
      const numFrontendServices = result.frontendServices.length;

      expect(numBackendServices).toEqual(0);
      expect(numFrontendServices).toEqual(0);
    });
    it('should return empty arrays when no services are parsed due to an empty leading detached comments array', () => {
      const fileDescriptorProto = new FileDescriptorProto({
        sourceCodeInfo: new SourceCodeInfo({
          location: [
            new Location({
              leadingDetachedComments: [],
            }),
          ],
        }),
      });

      const result = determineServices(services, fileDescriptorProto);
      const numBackendServices = result.backendServices.length;
      const numFrontendServices = result.frontendServices.length;

      expect(numBackendServices).toEqual(0);
      expect(numFrontendServices).toEqual(0);
    });
  });
});
