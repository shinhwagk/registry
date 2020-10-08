import * as path from 'path';
import * as http from 'http';

import got from 'got';
import { existsSync, mkdirpSync, rmdirSync, removeSync } from 'fs-extra';
import { Logger } from 'winston';

import { chunksQueue } from './queue'
import { mergeFile, sha256sumOnFile } from '../helper';
import { envDownChunkSize } from '../constants'
import { DownTaskChunk, DownTaskChunkConfig } from './chunk';
import * as logger from '../logger'
import { v4 } from 'uuid';

export interface DownTaskConfig {
    readonly name: string;
    readonly url: string;
    readonly fname: string;
    readonly dest: string;
    readonly cacheDest: string;
    readonly sha256: string;
    readonly headers: http.IncomingHttpHeaders;
}

export class DownTask {

    private readonly id: string;
    private readonly log: Logger;
    private blobBytes = 0;
    private readonly chunks: DownTaskChunkConfig[] = []
    private readonly destFile: string;
    private readonly cacheDest: string;

    constructor(public readonly c: DownTaskConfig) {
        this.id = this.getId()
        this.log = logger.create(`DownTask ${this.id}`)
        this.destFile = path.join(this.c.dest, this.c.fname)
        this.cacheDest = path.join(c.cacheDest, v4())
    }

    getId(): string {
        return this.c.name + '@' + this.c.sha256.substr(0, 19)
    }

    private mkdirDests() {
        mkdirpSync(this.c.dest)
        mkdirpSync(this.cacheDest)
    }

    private async reqblobSize(): Promise<void> {
        const headers = this.c.headers || {}
        const res = (await got.head(this.c.url, { headers }))
        this.blobBytes = Number(res.headers['content-length'])
    }

    private makeChunks(): void {
        const cs = Number(envDownChunkSize)
        const chunksNumber = (this.blobBytes / cs >> 0) + 1
        for (let i = 0; i < chunksNumber; i++) {
            const r_start = i * cs
            const headers: http.IncomingHttpHeaders = JSON.parse(JSON.stringify(this.c.headers))
            if (chunksNumber - 1 === i) {
                const size = this.blobBytes - r_start
                headers.range = `bytes=${r_start}-${this.blobBytes - 1}`
                this.chunks.push({ id: "", seq: i, url: this.c.url, headers, dest: this.cacheDest, size })
                continue
            }
            const r_end = r_start + cs - 1
            const size = r_end - r_start + 1
            headers.range = `bytes=${r_start}-${r_end}`
            this.chunks.push({ id: "", seq: i, url: this.c.url, headers, dest: this.cacheDest, size })
        }
    }

    private cleanblob(): void {
        removeSync(this.destFile)
    }

    private async combineChunks(): Promise<void> {
        this.cleanblob()
        this.log.info(this.id + " combineChunks")
        for (const cf of Object.keys(this.chunks)
            .map((id) => path.join(this.cacheDest, id))) {
            await mergeFile(cf, this.destFile)
        }
        this.log.info(this.id + ' combine chunks success.')
    }

    private cleanCache() {
        rmdirSync(this.cacheDest, { recursive: true })
    }

    private async checkblobShasum(): Promise<boolean> {
        return await sha256sumOnFile(this.destFile) === this.c.sha256
    }

    private async checkIsDown(): Promise<boolean> {
        if (existsSync(this.destFile) && await this.checkblobShasum()) {
            return false
        }
        return true
    }

    async start(): Promise<void> {
        this.log.info('start')
        if (!(await this.checkIsDown())) {
            this.log.info('blob exist and vaild.')
            return
        }
        this.mkdirDests()
        await this.reqblobSize()
        this.makeChunks()
        const execChunks = this.chunks.map(chunk => {
            const task = new DownTaskChunk(chunk)
            return new Promise<void>((res, rej) => {
                chunksQueue.push({ task }, (e) => {
                    if (e) {
                        rej(e.message)
                    } else {
                        console.log(chunk.seq, this.chunks.length, this.c.sha256.substr(19), 'success')
                        res()
                    }
                })
            })
        })
        try {
            await Promise.all(execChunks)
            await this.combineChunks()
            console.log("blob sha256sum ok")
            this.log.info('blob sha256sum ok')
        } finally {
            this.log.info('end')
            this.cleanCache()
        }
    }
}
