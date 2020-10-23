import { existsSync, rmdirSync, unlinkSync, writeFileSync } from 'fs';
import { google } from 'ts-proto/build/pbjs';
import { determineServices, loadServices, Service, Services } from './core';
import FileDescriptorProto = google.protobuf.FileDescriptorProto;
import SourceCodeInfo = google.protobuf.SourceCodeInfo;
import Location = google.protobuf.SourceCodeInfo.Location;

describe('core', () => {
  describe('Service', () => {
    const rootDir = './service-test';
    const protosDir = './service-test/protos/';
    const generatedDir = './service-test/generated/';

    afterEach(() => {
      rmdirSync(protosDir);
      rmdirSync(generatedDir);
      rmdirSync(rootDir);
    });

    it('should calculate protos dir from root dir', () => {
      const service = new Service(rootDir);

      expect(service.protosDir).toEqual(protosDir);
    });

    it('should calculate generated dir from root dir', () => {
      const service = new Service(rootDir);

      expect(service.generatedDir).toEqual(generatedDir);
    });

    it("should create the protos dir if it doesn't exist", () => {
      const service = new Service(rootDir);

      const dirExists = existsSync(service.protosDir);
      expect(dirExists).toBe(true);
    });

    it("should create the generated dir if it doesn't exist", () => {
      const service = new Service(rootDir);

      const dirExists = existsSync(service.generatedDir);
      expect(dirExists).toBe(true);
    });
  });

  describe('loadServices', () => {
    it('should load the services in the JSON file', () => {
      const filePath = './loadServices-test-services.json';
      const fooRootDir = '../foo';
      const barRootDir = '../bar';
      const services = {
        foo: {
          rootDir: fooRootDir,
        },
        bar: {
          rootDir: barRootDir,
        },
      };
      writeFileSync(filePath, JSON.stringify(services));

      const result = loadServices(filePath);

      expect(result['foo']).toBeDefined();
      expect(result['foo'].protosDir).toEqual(`${fooRootDir}/protos/`);
      expect(result['bar']).toBeDefined();
      expect(result['bar'].generatedDir).toEqual(`${barRootDir}/generated/`);

      unlinkSync(filePath);
      rmdirSync(result['foo'].generatedDir);
      rmdirSync(result['foo'].protosDir);
      rmdirSync(fooRootDir);
      rmdirSync(result['bar'].generatedDir);
      rmdirSync(result['bar'].protosDir);
      rmdirSync(barRootDir);
    });
  });

  describe('determineServices', () => {
    const services: Services = {
      fooBackend: new Service('./determineServices-test-fooBackend'),
      fooFrontend: new Service('./determineServices-test-fooFrontend'),
      barBackend: new Service('./determineServices-test-barBackend'),
      barFrontend: new Service('./determineServices-test-barFrontend'),
    };
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
    it('should parse a multiple backend services', () => {
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
    it('should parse a multiple frontend services', () => {
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
    it('should return empty arrays when no services are parsed', () => {
      const fileDescriptorProto = new FileDescriptorProto();

      const result = determineServices(services, fileDescriptorProto);
      const numBackendServices = result.backendServices.length;
      const numFrontendServices = result.frontendServices.length;

      expect(numBackendServices).toEqual(0);
      expect(numFrontendServices).toEqual(0);
    });
  });
});
