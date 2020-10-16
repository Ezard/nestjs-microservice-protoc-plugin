import { existsSync, rmdirSync, unlinkSync, writeFileSync } from 'fs';
import { loadServices, Service } from './core';

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
});
