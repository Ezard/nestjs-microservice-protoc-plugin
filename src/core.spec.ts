import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { google } from 'ts-proto/build/pbjs';
import { BASE_TEST_DIR } from '../test/utils';
import { determineServices, generateFiles, loadServices, Service, Services } from './core';
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
      const fooBackendInBackends = result.backendServices.includes(services['fooBackend']);
      const fooBackendInFrontends = result.frontendServices.includes(services['fooBackend']);

      expect(fooBackendInBackends).toEqual(true);
      expect(fooBackendInFrontends).toEqual(false);
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
      const fooBackendInBackends = result.backendServices.includes(services['fooBackend']);
      const barBackendInBackends = result.backendServices.includes(services['barBackend']);
      const fooBackendInFrontends = result.frontendServices.includes(services['fooBackend']);
      const barBackendInFrontends = result.frontendServices.includes(services['barBackend']);

      expect(fooBackendInBackends).toEqual(true);
      expect(barBackendInBackends).toEqual(true);
      expect(fooBackendInFrontends).toEqual(false);
      expect(barBackendInFrontends).toEqual(false);
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
      const fooFrontendInFrontends = result.frontendServices.includes(services['fooFrontend']);
      const fooFrontendInBackends = result.backendServices.includes(services['fooFrontend']);

      expect(fooFrontendInFrontends).toEqual(true);
      expect(fooFrontendInBackends).toEqual(false);
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
      const fooFrontendInFrontends = result.frontendServices.includes(services['fooFrontend']);
      const barFrontendInFrontends = result.frontendServices.includes(services['barFrontend']);
      const fooFrontendInBackends = result.backendServices.includes(services['fooFrontend']);
      const barFrontendInBackends = result.backendServices.includes(services['barFrontend']);

      expect(fooFrontendInFrontends).toEqual(true);
      expect(barFrontendInFrontends).toEqual(true);
      expect(fooFrontendInBackends).toEqual(false);
      expect(barFrontendInBackends).toEqual(false);
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

      const fooBackendInBackends = result.backendServices.includes(services['fooBackend']);
      const barBackendInBackends = result.backendServices.includes(services['barBackend']);
      const fooFrontendInFrontends = result.frontendServices.includes(services['fooFrontend']);
      const barFrontendInFrontends = result.frontendServices.includes(services['barFrontend']);

      const fooBackendInFrontends = result.frontendServices.includes(services['fooBackend']);
      const barBackendInFrontends = result.frontendServices.includes(services['barBackend']);
      const fooFrontendInBackends = result.backendServices.includes(services['fooFrontend']);
      const barFrontendInBackends = result.backendServices.includes(services['barFrontend']);

      expect(fooBackendInBackends).toEqual(true);
      expect(barBackendInBackends).toEqual(true);
      expect(fooFrontendInFrontends).toEqual(true);
      expect(barFrontendInFrontends).toEqual(true);

      expect(fooBackendInFrontends).toEqual(false);
      expect(barBackendInFrontends).toEqual(false);
      expect(fooFrontendInBackends).toEqual(false);
      expect(barFrontendInBackends).toEqual(false);
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

  describe('generateFiles', () => {
    const testDir = join(rootTestDir, 'generateFiles');
    const servicesFile = join(testDir, 'services.json');
    const protosDir = join(testDir, 'protos');

    beforeEach(() => {
      mkdirSync(testDir, { recursive: true });
      writeFileSync(
        servicesFile,
        JSON.stringify({
          foo: {
            rootDir: join(testDir, 'foo'),
          },
        }),
        { encoding: 'utf-8' },
      );
    });

    afterEach(() => {
      rmSync(testDir, { recursive: true, force: true });
    });

    it('should generate types files for backend services', async () => {
      const fileDescriptorProtos = [
        new FileDescriptorProto({
          name: 'foo.proto',
          sourceCodeInfo: new SourceCodeInfo({
            location: [
              new Location({
                leadingDetachedComments: ['backend-services=foo'],
              }),
            ],
          }),
        }),
      ];

      const result = await generateFiles(fileDescriptorProtos, servicesFile, protosDir);
      const typesFile = result.find(file => file.name.endsWith('.types.ts'));

      expect(typesFile).toBeDefined();
    });
    it('should generate types files for frontend services', async () => {
      const fileDescriptorProtos = [
        new FileDescriptorProto({
          name: 'foo.proto',
          sourceCodeInfo: new SourceCodeInfo({
            location: [
              new Location({
                leadingDetachedComments: ['frontend-services=foo'],
              }),
            ],
          }),
        }),
      ];

      const result = await generateFiles(fileDescriptorProtos, servicesFile, protosDir);
      const typesFile = result.find(file => file.name.endsWith('.types.ts'));

      expect(typesFile).toBeDefined();
    });
    it('should generate backend files for backend services', async () => {
      const fileDescriptorProtos = [
        new FileDescriptorProto({
          name: 'foo.proto',
          sourceCodeInfo: new SourceCodeInfo({
            location: [
              new Location({
                leadingDetachedComments: ['backend-services=foo'],
              }),
            ],
          }),
        }),
      ];

      const result = await generateFiles(fileDescriptorProtos, servicesFile, protosDir);
      const typesFile = result.find(file => file.name.endsWith('.backend.ts'));

      expect(typesFile).toBeDefined();
    });
    it('should generate frontend files for frontend services', async () => {
      const fileDescriptorProtos = [
        new FileDescriptorProto({
          name: 'foo.proto',
          sourceCodeInfo: new SourceCodeInfo({
            location: [
              new Location({
                leadingDetachedComments: ['frontend-services=foo'],
              }),
            ],
          }),
        }),
      ];

      const result = await generateFiles(fileDescriptorProtos, servicesFile, protosDir);
      const typesFile = result.find(file => file.name.endsWith('.frontend.ts'));

      expect(typesFile).toBeDefined();
    });
  });
});
