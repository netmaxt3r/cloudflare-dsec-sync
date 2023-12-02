import cloudflare from 'cloudflare';
import desc from './dsec';
import { getProxyResolver } from './proxy-resolve';
import './utils';

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
        const pr = getProxyResolver(zone.name_servers);
        const drs = await pr.query('_acme-challenge.' + domain, 'TXT');
        const cRecords: cloudflare.DnsRecord[] = drs.answers.map(x => {
            return {
                type: 'TXT',
                name: '_acme-challenge.' + domain,
                content: `"${x.data}"`,
                zone_name: domain,
                ttl: 60,
            };
        });

        await descClient.clear('_acme-challenge', 'TXT');
        await descClient.getRecords();

        if (cRecords.length > 0) {
            await descClient.createRecord(cRecords);
            console.log('records updated');
        }
    }
}


main();
