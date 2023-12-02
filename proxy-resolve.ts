import dns, { DnsAnswer, Packet } from 'dns2';
import cloudflare from 'cloudflare';

export function getProxyResolver(servers: string[]): ProxyResolver {
    const dnsClient = new dns({
        nameServers: servers,
    });
    return {
        async resolveProxyRecord(record: cloudflare.DnsRecord): Promise<cloudflare.DnsRecord[] | undefined> {
            const type = record.type;
            let resolver: ((domain: string) => Promise<DnsAnswer[]>) | undefined = undefined;
            let name: string = '';
            switch (type) {

                case 'A':
                    name = record.name;
                    resolver = async (domain: string) => {
                        const r = await dnsClient.resolveA(domain);
                        return r.answers;
                    };
                    break;
                case 'AAAA':
                    name = record.name;

                    resolver = async (domain: string) => {
                        const r = await dnsClient.resolveAAAA(domain);
                        return r.answers;
                    };
                    break;
                case 'CNAME':
                    name = record.name;

                    resolver = async (domain: string) => {
                        const r = await dnsClient.resolveA(domain);
                        const r2 = await dnsClient.resolveAAAA(domain);
                        return [...r.answers, ...r2.answers];
                    };
                    break;
                default:
            }
            if (resolver) {
                const r = await resolver(name);
                if (r) {
                    return r.map(x => {
                        return {
                            ...record,
                            type: (x.type === Packet.TYPE.A ? 'A' : 'AAAA'),
                            content: x.address!,
                        } as cloudflare.DnsRecord;
                    });
                }
            }
            return undefined;
        },

    };
}

export interface ProxyResolver {
    resolveProxyRecord(r: cloudflare.DnsRecord): Promise<cloudflare.DnsRecord[] | undefined>;
}
