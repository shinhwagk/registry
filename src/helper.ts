import * as crypto from 'crypto'
import * as fs from 'fs-extra'

export function sleep(ms: number): Promise<void> {
    return new Promise((res) => setTimeout(res, ms));
}

export async function sha256sum(file: string): Promise<string> {
    return new Promise<string>((res) => {
        const fd = fs.createReadStream(file);
        const hash = crypto.createHash('sha256');
        hash.setEncoding('hex');
        fd.on('end', () => { hash.end(); res(hash.read()); }).pipe(hash);
    })
}

export async function mergeFile(input: string, output: string, flags = 'a'): Promise<void> {
    return new Promise((res, rej) => {
        fs.createReadStream(input).pipe(fs.createWriteStream(output, { flags })).on('finish', () => res()).on('error', (err) => rej(err.message))
    })
}
