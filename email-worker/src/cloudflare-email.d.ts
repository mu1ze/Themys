declare module "cloudflare:email" {
  export const EmailMessage: {
    new (from: string, to: string, raw: ReadableStream | string): {
      readonly from: string
      readonly to: string
    }
  }
}
