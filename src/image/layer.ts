import * as fs from 'fs-extra';
import * as path from 'path'

import { storageDir, proxyRepo } from '../constants'
import { sha256sum } from '../helper';
import { dmgr } from '../down/manager';
import { ReadStream } from 'fs-extra';
import { DownTask } from '../down/down';
import * as logger from '../logger'

/**
 * 1. check layer of image exist
 * 2. check layer of image sha256 validity
 * 3. down layer of image by DownManager
 */

export class ProxyLayer {

    public static create(owner: string, image: string, sha256: string, auth?: string): ProxyLayer {
        return new ProxyLayer(owner + '/' + image, sha256, auth)
    }

    private readonly log = logger.create(`layer ${this.name}@sha256:${this.sha256.substr(0, 12)}`)
    private readonly layerFile: string

    constructor(private readonly name: string, private readonly sha256: string, private readonly auth?: string) {
        this.layerFile = path.join(storageDir, proxyRepo, name, sha256, 'blobs')
        this.init()
    }

    private init() {
        fs.mkdirpSync(path.join(storageDir, proxyRepo))
    }

    private checkExist() {
        return fs.existsSync(this.layerFile)
    }

    private async checkSha256() {
        return (await sha256sum(this.layerFile)) === this.sha256
    }

    public blobsStream(): ReadStream {
        return fs.createReadStream(this.layerFile)
    }

    private async down() {
        this.log.debug('create down task: ' + `${this.url()}:${this.dest()}:${this.name}:${this.sha256}:${this.auth}`)
        const task = new DownTask(this.url(), this.dest(), this.name, this.sha256, this.auth)
        this.log.debug('add task to DownManager.')
        await dmgr.wait(task)
        this.log.info('down success')
    }

    private url() {
        return `https://${proxyRepo}/v2/${this.name}/blobs/sha256:${this.sha256}`
    }

    private dest() {
        return path.join(storageDir, proxyRepo, this.name, this.sha256)
    }

    public async verify(): Promise<void> {
        if (this.checkExist() && await this.checkSha256()) {
            this.log.debug(`blobs ready.`)
            return
        }
        this.log.debug(`blobs unreliable.`)
        await this.down()
    }
}