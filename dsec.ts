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

    async checkExits(record: cloudflare.DnsRecord) {
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
            const name = record.name + '.';
            const ss = this.transformRecordContent(record);
            let zoneName = (record as any).zone_name;
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
}

