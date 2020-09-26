
import * as path from 'path'

import { statSync, existsSync, mkdirpSync, readJSON, readJsonSync } from 'fs-extra'

import { envStorageDir } from './constants'
import { sha256sum } from './helper'
import { readFileSync } from 'fs'

export interface ManifestSchema {
    schemaVersion: 1 | 2
    mediaType: 'application/vnd.docker.distribution.manifest.v2+json' | 'application/vnd.docker.distribution.manifest.list.v2+json'
}

// export interface ManifestSchemaV1 extends ManifestSchema {
//     schemaVersion: 1
//     mediaType: 'vnd.docker.distribution.manifest.v1+json'
// }

// export interface ManifestSchemaV2 extends ManifestSchema {
//     schemaVersion: 2
//     mediaType: 'application/vnd.docker.distribution.manifest.v2+json'
// }

// export interface ManifestSchemaV2List extends ManifestSchema {
//     schemaVersion: 2
//     mediaType: 'application/vnd.docker.distribution.manifest.list.v2+json'
// }

// export function instanceOfA(object: ManifestSchema): object is ManifestSchemaV2 {
//     return object.schemaVersion === 2;
// }

// export function instanceOfB(object: ManifestSchema): object is ManifestSchemaV1 {
//     return object.schemaVersion === 1;
// }

export const BlobsCacheDirectory = path.join(envStorageDir, 'cache', 'blobs')

export const ManifestsCacheDirectory = path.join(envStorageDir, 'cache', 'manifests')

export function createBlobsCacheDirectory(): void {
    mkdirpSync(BlobsCacheDirectory)
}

export function createManifestsCacheDirectory(): void {
    mkdirpSync(ManifestsCacheDirectory)
}

export function createManifestsDirectories(name: string, ref: string): void {
    mkdirpSync(getManifestsDirectory(name, ref))
    mkdirpSync(getManifestsDirectory(name, 'sha256'))
}

export function createBlobsDirectory(name: string): void {
    mkdirpSync(getBlobsDirectory(name))
}

export function getBlobsDirectory(name: string): string {
    return path.join(envStorageDir, name, 'blobs')
}

export function getBlobsFilePath(name: string, digest: string): string {
    return path.join(getBlobsDirectory(name), digest)
}

export function checkBlobsExist(name: string, digest: string): boolean {
    return existsSync(getBlobsFilePath(name, digest))
}

export function getManifestsDirectory(name: string, ref: string): string {
    if (ref.startsWith('sha256')) {
        return path.join(envStorageDir, name, 'manifests', 'digests')
    } else {
        return path.join(envStorageDir, name, 'manifests', 'tags', ref)
    }
}

export function getBlobsSize(name: string, sha: string): number {
    return statSync(getBlobsFilePath(name, sha)).size
}

export async function checkBlobsSha256sum(name: string, sha: string): Promise<boolean> {
    return (await sha256sum(getBlobsFilePath(name, sha))) === sha.substr(7)
}

export function getManifestFileForDigest(name: string, ref: string): string {
    return path.join(getManifestsDirectory(name, ref), ref)
}

export function getManifestFilePath(name: string, ref: string): string {
    if (ref.startsWith('sha256:')) {
        return getManifestFileForDigest(name, ref)
    } else {
        return getManifestFileForTags(name, ref)
    }
}

// export function getManifest(name: string, ref: string): ManifestSchema {
//     const manifestFile = ref.startsWith('sha256:') ?
//         getManifestFilePath(name, ref) :
//         getManifestFilePath(name, readFileSync(getManifestFilePath(name, ref), { encoding: 'utf8' }))
//     return readJsonSync(manifestFile)
// }

function getManifestFileForTags(name: string, tag: string): string | undefined {
    const tagDirectory = getManifestsDirectory(name, tag)
    console.log("tagDirectory", tagDirectory)
    if (existsSync(path.join(tagDirectory, 'vnd.docker.distribution.manifest.list.v2+json'))) {
        return path.join(tagDirectory, 'vnd.docker.distribution.manifest.list.v2+json')
    }
    console.log(path.join(tagDirectory, 'vnd.docker.distribution.manifest.v2+json'))
    if (existsSync(path.join(tagDirectory, 'vnd.docker.distribution.manifest.v2+json'))) {
        return path.join(tagDirectory, 'vnd.docker.distribution.manifest.v2+json')
    }
    if (existsSync(path.join(tagDirectory, 'vnd.docker.distribution.manifest.v1+json'))) {
        return path.join(tagDirectory, 'vnd.docker.distribution.manifest.v1+json')
    }
    return undefined
}

createManifestsCacheDirectory()
createBlobsCacheDirectory()