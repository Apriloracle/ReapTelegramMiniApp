declare module '@digitalbazaar/ed25519-verification-key-2020' {
  export class Ed25519VerificationKey2020 {
    static generate(): Promise<Ed25519VerificationKey2020>;
    publicKeyMultibase: string;
  }
}
