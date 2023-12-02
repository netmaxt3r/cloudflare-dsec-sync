import axios from 'axios';
import cloudflare from 'cloudflare';

export default class dSec {
    private url = 'https://desec.io/api/v1/domains/';
    private records: DRecord[] = [];

    constructor(private apiKey: string, private domain: string) {
    }

    async getRecords(): Promise<DRecord[]> {
        const recs = await this.get('rrsets');
        this.records = [...recs];
        return recs;
    }

    checkExits(record: cloudflare.DnsRecord) {
        const r = this.findRecord(record);
        const c = this.transformRecordContent(record);
        if (r) {
            for (let rc of r.records) {
                if (rc == c) return true;
            }
        }

        return false;
    }

    async createRecord(records: cloudflare.DnsRecord[]) {
        const rx: DRecord[] = [];
        for (let record of records) {
            if (record.type === 'SRV') continue; //TODO SRV
            const ss = this.transformRecordContent(record);
            let zoneName = record.zone_name;
            const subname = zoneName == record.name ? '' : record.name.replace('.' + zoneName, '');
            let ri = rx.find(x =>
                x.type === record.type && x.subname === subname);
            if (ri == null) {
                ri = this.findRecord(record);
                if (ri != null) rx.push(ri!);
            }
            if (ri == null) {
                ri = { type: record.type, subname: subname, ttl: record.ttl * 60, records: [] } as any;
                rx.push(ri!);
            }
            ri?.records.push(ss!);

        }
        return this.patch(`rrsets/`, JSON.stringify(rx));
    }

    async clearExtra(records: cloudflare.DnsRecord[]) {
        const rx: DRecord[] = [];
        for (let record of this.records) {
            record.removeRecords = [];
            if (record.type === 'NS') continue; // don't touch NS keep as it initial manual setup
            if (record.type === 'SRV') continue; // TODO SRV
            if (record.type === 'TXT' && record.subname == '_acme-challenge') continue; // acme records hidden on cloudflare rest api

            const crs = records.filter(
                (x: any) => x.type == record.type &&
                    x.name + '.' === record.name,
            );
            const crsX = crs.map(x => {
                return {
                    ...x,
                    trc: this.transformRecordContent(x),
                };
            });
            for (let r of record.records) {
                const cr = crsX.find(x => x.trc === r);
                if (!cr) {
                    console.log('extra record', record.type, record.name, r);
                    record.removeRecords.push(r);
                }
            }
        }
        const mods = this.records.filter(x => x.removeRecords && x.removeRecords.length > 0);
        for (let mod of mods) {
            const nr = mod.records.filter(x => {
                return !mod.removeRecords?.includes(x);
            });
            rx.push({
                ...mod,
                records: nr,
                removeRecords: undefined,
            });
        }
        if (rx.length > 0)
            return this.patch(`rrsets/`, JSON.stringify(rx));
        return [];
    }

    async clear(sub: string, type: string) {
        const rx: Partial<DRecord>[] = [];
        rx.push({
            subname: sub,
            type: type,
            records: [],
        });

        return this.patch(`rrsets/`, JSON.stringify(rx));
    }

    private async get(path: string) {
        let config = {
            method: 'get',
            url: `${this.url}/${this.domain}/${path}`,
            headers: {
                'Authorization': `Token ${this.apiKey}`,
            },
        };
        let resp = await axios.request(config);
        return resp.data;
    }

    private async patch(path: string, data: string) {
        let config = {
            method: 'patch',
            url: `${this.url}/${this.domain}/${path}`,
            headers: {
                'Authorization': `Token ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            data: data,
        };
        // console.log('PATCH', data);
        let resp = await axios.request(config);
        return resp.data;
    }

    private findRecord(record: cloudflare.DnsRecord) {
        const type = record.type;
        switch (type) {

            case 'SRV':
                //TODO
                break;
            case 'MX':
            case 'URI':
            default:
                // console.log(record.type, record.name, record.content);
                const name = record.name + '.';
                const dgrt = this.records.find(x => x.type === record.type && x.name === name);
                if (dgrt) {
                    return dgrt;
                }

        }
        return undefined;
    }

    private transformRecordContent(record: cloudflare.DnsRecord) {
        const type = record.type;
        switch (type) {

            case 'SRV':
                //TODO
                break;
            case 'MX':
                return `${record.priority} ${record.content}.`;
            case 'URI':
                break;
            case 'TXT':
                let content = record.content;
                if (content.match(/^".*"$/)) return content;
                return `"${content}"`;
            default:
                return record.content;
        }
    }
}

interface DRecord {
    domain: string;
    subname: string;
    name: string;
    type: string;
    records: string[];
    ttl: number;
    created: string;
    touched: string;
    removeRecords?: string[];
}

