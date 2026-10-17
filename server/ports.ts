function port(value: string | undefined, fallback: number) {
 const number = value === undefined ? fallback : Number(value);
 if (!Number.isInteger(number) || number < 1024 || number > 65535) throw new Error('Go 100 Lab 端口必须是 1024–65535 的整数');
 return number;
}
export const apiPort = port(process.env.GO100_API_PORT, 4318);
export const webPort = port(process.env.GO100_WEB_PORT, 4317);
export const localHosts = [apiPort,webPort].flatMap(p=>['127.0.0.1','localhost'].map(host=>`${host}:${p}`));
