import cloudflare from 'cloudflare';
import dSec from './dsec';

export function dnsToString(r: cloudflare.DnsRecord) {
    const type = r.type;
    switch (type) {

        case 'SRV':
            //TODO
            return [r.type, r.data.name, r.data.service];
        case 'MX':
        case 'URI':
        default:
            return [r.type, r.name, r.content];
    }
}

export function missingRecordsInDSec(records: cloudflare.DnsRecord[], descClient: dSec) {
    const missingRecords: cloudflare.DnsRecord[] = [];
    if (records != null) {
        for (let cRecord of records) {
            const exists = descClient.checkExits(cRecord);
            if (!exists) {
                console.error('missing record', ...dnsToString(cRecord));
                missingRecords.push(cRecord);
            } else {
                // console.info('existing record', cRecord);
            }

        }
    }
    return missingRecords;
}

declare module 'cloudflare' {
    interface DnsRecordWithPriority {
        zone_name: string;
    }

    interface DnsRecordWithoutPriority {
        zone_name: string;
    }
}
