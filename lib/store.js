class Store {
  constructor(){
    this.websites = new Map();
    this.buckets  = new Map();
  }
}

module.exports = new Store;