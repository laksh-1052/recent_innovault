import Debug "mo:base/Debug"


actor {
  public query func greet(name : Text) : async Text {
    return "Hello, " # name # "!";
    
  };
  Debug.print("hi");
};
