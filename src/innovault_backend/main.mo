import Debug "mo:base/Debug";
import Array "mo:base/Array";
import Text "mo:base/Text";
import Http "mo:base/Http";
import Principal "mo:base/Principal";

actor Storage {
  type FileRecord = {
    name: Text;
    passcode: Text;
    cid: Text;
  };

  stable var files: [FileRecord] = [];

  public func storeFile(name: Text, passcode: Text, cid: Text): async Text {
    files := Array.append(files, [{ name, passcode, cid }]);
    return "File stored successfully";
  };

  public query func getFileDetails(passcode: Text): async ?FileRecord {
    Array.find(files, func (f) = f.passcode == passcode);
  };

  public func fetchFileFromNodeJsServer(passcode: Text): async ?Blob {
    let fileRecordOpt = Array.find(files, func (f) = f.passcode == passcode);
    switch (fileRecordOpt) {
      case (?fileRecord): {
        let url = Text.concat("http://localhost:3000/get-file?cid=", fileRecord.cid);
        let request = Http.Request(url, #get);
        let response = await Http.fetch(request);
        
        if (response.status == 200) {
          return response.body;
        } else {
          return null;
        }
      };
      case null: return null;
    }
  };
}
