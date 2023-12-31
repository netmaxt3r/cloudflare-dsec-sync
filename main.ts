import cloudflare from 'cloudflare';
import desc from './dsec';
import { getProxyResolver } from './proxy-resolve';
import { missingRecordsInDSec } from './utils';

const domain = process.env.SYNC_DOMAIN || '';
if (domain == '') {
    console.error('missing domain please set SYNC_DOMAIN env variable');
    process.exit(2);
}
const dSecToken = process.env.SYNC_DSEC_TOKEN || '';
if (domain == '') {
    console.error('missing desec.io api token please set SYNC_DSEC_TOKEN env variable');
    process.exit(2);
}
const cfToken = process.env.SYNC_CF_TOKEN || '';
if (domain == '') {
    console.error('missing cloudflare api token please set SYNC_CF_TOKEN env variable');
    process.exit(2);
}
const descClient = new desc(dSecToken, domain);
var cf = new cloudflare({
    token: cfToken,
});


async function main() {
    await descClient.getRecords();
    // console.log(grouped);
    const zoneResults: any = await cf.zones.browse();
    const zone = zoneResults.result.find((zone: any) => zone.name === domain);
    if (zone) {
        const crecsResult = await cf.dnsRecords.browse(zone.id, {
            per_page: 10000,
        });
        // console.log(zone);
        const pr = getProxyResolver(zone.name_servers);
        const cRecords: cloudflare.DnsRecord[] = [];
        if (crecsResult.result) {
            for (let r of crecsResult.result) {
                if ((r.type === 'A' || r.type === 'AAAA' || r.type === 'CNAME') && r.proxied) {
                    const rcs = await pr.resolveProxyRecord(r);
                    if (rcs) cRecords.push(...rcs);
                } else {
                    cRecords.push(r);
                }
            }
        }

        const missingRecords: cloudflare.DnsRecord[] = missingRecordsInDSec(cRecords, descClient);

        if (missingRecords.length > 0) {
            const r = await descClient.createRecord(missingRecords);
            // console.log(r);
            console.log('records updated');
            await descClient.getRecords();
        } else {
            console.log('no missing records');
        }
        const rc = await descClient.clearExtra(cRecords);
        console.log('updated ', rc.length);


    }
}


main();
