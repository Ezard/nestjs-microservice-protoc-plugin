import {existsSync, rmdirSync} from 'fs';
import {Service} from './core';

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
});
