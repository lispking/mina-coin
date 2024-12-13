import { SmartContract, state, State, PublicKey, UInt64, DeployArgs, Permissions, method, UInt32, AccountUpdate, Provable, Struct, Field } from 'o1js';

export class DeployEvent extends Struct({
  who: PublicKey,
  deadline: UInt32,
  hardCap: UInt64,
  fixedPrice: UInt64,
  timestamp: UInt32,
}){}

export class ContributedEvent extends Struct({
  who: PublicKey,
  amount: UInt64,
  timestamp: UInt32,
}){}

export class WithdrawnEvent extends Struct({
  who: PublicKey,
  amount: UInt64,
  timestamp: UInt32,
}){}

/**
 * CrowdFunding smart contract
 * See https://docs.minaprotocol.com/zkapps for more info.
 */
export class CrowdFunding extends SmartContract {
  @state(PublicKey) investor = State<PublicKey>();
  @state(UInt32) deadline = State<UInt32>();
  @state(UInt64) hardCap = State<UInt64>();
  @state(UInt64) fixedPrice = State<UInt64>();
  @state(UInt64) soldAmount = State<UInt64>();

  events = {
    Deploy: DeployEvent,
    Contributed: ContributedEvent,
    Withdrawn: WithdrawnEvent,
  }

  async deploy(args: DeployArgs & {
    deadline: UInt32;
    hardCap: UInt64;
    fixedPrice: UInt64;
  }) {
    await super.deploy(args);
    this.account.permissions.set({
      ...Permissions.default(),
      send: Permissions.proof(),
      setVerificationKey: Permissions.VerificationKey.impossibleDuringCurrentVersion(),
      setPermissions: Permissions.impossible(),
    });
  
    const sender = this.sender.getAndRequireSignature();
    this.investor.set(sender);
    this.deadline.set(args.deadline);
    this.hardCap.set(args.hardCap);
    this.fixedPrice.set(args.fixedPrice);
    this.soldAmount.set(UInt64.from(0));
    this.emitEvent('Deploy', {
      who: sender,
      deadline: args.deadline,
      hardCap: args.hardCap,
      fixedPrice: args.fixedPrice,
      timestamp: this.network.blockchainLength.getAndRequireEquals(),
    });
  }

  @method async contribute() {
    const sender = this.sender.getAndRequireSignature();
    const fixedPrice = this.ensureContribution(sender);

    const senderUpdate = AccountUpdate.createSigned(sender);
    senderUpdate.send({ to: this.address, amount: fixedPrice });

    const receiverAcctUpt = this.send({ to: sender, amount: fixedPrice });
    receiverAcctUpt.body.mayUseToken = AccountUpdate.MayUseToken.InheritFromParent;// MUST ADD THIS!

    this.emitEvent('Contributed', { 
      who: sender, 
      amount: fixedPrice, 
      timestamp: this.network.blockchainLength.getAndRequireEquals() 
    });
  }

  ensureContribution(sender: PublicKey): UInt64 {
    const currentTime = this.network.blockchainLength.getAndRequireEquals();
    const deadline = this.deadline.getAndRequireEquals();
    currentTime.assertLessThanOrEqual(deadline, "Deadline reached");

    const investor = this.investor.getAndRequireEquals();
    sender.equals(investor).assertFalse("Investor cannot contribute");

    const hardCap = this.hardCap.getAndRequireEquals();
    const soldAmount = this.soldAmount.getAndRequireEquals();
    soldAmount.assertLessThan(hardCap, "HardCap reached");

    const fixedPrice = this.fixedPrice.getAndRequireEquals();
    this.soldAmount.set(soldAmount.add(fixedPrice));
    return fixedPrice;
  }

  getBalance(tokenId: Field) {
    const senderUpdate = AccountUpdate.create(this.address, tokenId);
    return senderUpdate.account.balance.get();
  }

  getInvestor() {
    return this.investor.get();
  }

  getDeadline() {
    return this.deadline.get();
  }

  getHardCap() {
    return this.hardCap.get();
  }

  getFixedPrice() {
    return this.fixedPrice.get();
  }

  getSoldAmount() {
    return this.soldAmount.get();
  }
}
