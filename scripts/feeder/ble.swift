import CoreBluetooth
import Foundation

let service = CBUUID(string: "A1E0F000-1B2C-4D3E-9F80-1234567890AB")
let control = CBUUID(string: "A1E0F001-1B2C-4D3E-9F80-1234567890AB")
let dataID = CBUUID(string: "A1E0F002-1B2C-4D3E-9F80-1234567890AB")
func log(_ s: String) { FileHandle.standardError.write(Data((s + "\n").utf8)) }

final class Central: NSObject, CBCentralManagerDelegate, CBPeripheralDelegate {
    var manager: CBCentralManager!
    var peripheral: CBPeripheral?
    var ctrl: CBCharacteristic?
    var data: CBCharacteristic?
    var document = Data()
    var documentLength = 0
    var ready = false
    var pending: Data?
    var current: Data?
    var latest: Data?
    var offset = 0
    var phase = ""
    var controlWrites: [[UInt8]] = []
    func start() { manager = CBCentralManager(delegate: self, queue: .main) }
    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        guard central.state == .poweredOn else { log("bluetooth state \(central.state.rawValue)"); return }
        scan()
    }
    func scan() {
        log("scanning")
        if let p = manager.retrieveConnectedPeripherals(withServices: [service]).first(where: { $0.name == "puckling" }) { connect(p); return }
        manager.scanForPeripherals(withServices: nil)
    }
    func connect(_ p: CBPeripheral) { manager.stopScan(); peripheral = p; p.delegate = self; log("connecting"); manager.connect(p) }
    func centralManager(_ central: CBCentralManager, didDiscover p: CBPeripheral, advertisementData: [String: Any], rssi: NSNumber) {
        let advertisedName = advertisementData[CBAdvertisementDataLocalNameKey] as? String
        if ProcessInfo.processInfo.environment["PUCKLING_BLE_DEBUG"] == "1" { log("scan \(p.identifier) advertised=\(advertisedName ?? "") name=\(p.name ?? "") rssi=\(rssi)") }
        if advertisedName == "puckling" || p.name == "puckling" { connect(p) }
    }
    func centralManager(_ central: CBCentralManager, didConnect p: CBPeripheral) { log("connected"); p.discoverServices([service]) }
    func centralManager(_ central: CBCentralManager, didFailToConnect p: CBPeripheral, error: Error?) { log("connection failed"); scan() }
    func centralManager(_ central: CBCentralManager, didDisconnectPeripheral p: CBPeripheral, error: Error?) {
        log("disconnected"); if pending == nil { pending = latest }; current = nil; ready = false; ctrl = nil; data = nil; controlWrites = []; scan()
    }
    func peripheral(_ p: CBPeripheral, didDiscoverServices error: Error?) {
        guard error == nil, let s = p.services?.first(where: { $0.uuid == service }) else { manager.cancelPeripheralConnection(p); return }
        p.discoverCharacteristics([control, dataID], for: s)
    }
    func peripheral(_ p: CBPeripheral, didDiscoverCharacteristicsFor s: CBService, error: Error?) {
        ctrl = s.characteristics?.first { $0.uuid == control }; data = s.characteristics?.first { $0.uuid == dataID }
        guard let c = ctrl, data != nil, error == nil else { manager.cancelPeripheralConnection(p); return }
        p.setNotifyValue(true, for: c)
    }
    func peripheral(_ p: CBPeripheral, didUpdateNotificationStateFor c: CBCharacteristic, error: Error?) {
        guard error == nil, c.isNotifying else { manager.cancelPeripheralConnection(p); return }
        log("pairing"); send([0x10])
    }
    func send(_ bytes: [UInt8]) { if let p = peripheral, let c = ctrl { controlWrites.append(bytes); p.writeValue(Data(bytes), for: c, type: .withResponse) } }
    func peripheral(_ p: CBPeripheral, didUpdateValueFor c: CBCharacteristic, error: Error?) {
        guard error == nil, let value = c.value else { manager.cancelPeripheralConnection(p); return }
        if ProcessInfo.processInfo.environment["PUCKLING_BLE_DEBUG"] == "1" { log("read \(c.uuid) \(Array(value))") }
        if c.uuid == dataID {
            document.append(value)
            if document.count == documentLength {
                let code = String(data: document, encoding: .utf8) ?? ""
                guard code.count == 9, code.hasPrefix("pair "), code.dropFirst(5).allSatisfy({ $0.isNumber }) else { manager.cancelPeripheralConnection(p); return }
                send([0x12] + Array(code.utf8.dropFirst(5)))
            } else if !value.isEmpty && document.count < documentLength { p.readValue(for: c) }
            else { manager.cancelPeripheralConnection(p) }
            return
        }
        guard let op = value.first else { return }
        switch op {
        case 0x91:
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { self.send([0x01]) }
        case 0x81:
            guard value.count == 3 else { manager.cancelPeripheralConnection(p); return }
            documentLength = Int(value[1]) << 8 | Int(value[2])
            guard documentLength == 9 else { manager.cancelPeripheralConnection(p); return }
            document = Data(); if let d = data { p.readValue(for: d) }
        case 0x93:
            log("paired"); ready = true; pump()
        case 0x83:
            log("delivered"); current = nil; phase = ""; pump()
        case 0x84, 0x94:
            log("protocol error \(Array(value))"); manager.cancelPeripheralConnection(p)
        default: break
        }
    }
    func enqueue(_ blob: Data) { guard blob.count > 0 && blob.count <= 4096 else { log("invalid blob length"); return }; latest = blob; pending = blob; pump() }
    func pump() {
        guard ready, current == nil, let blob = pending else { return }
        pending = nil; current = blob; offset = 0; phase = "begin"
        send([0x02, UInt8(blob.count >> 8), UInt8(blob.count & 255)])
    }
    func peripheral(_ p: CBPeripheral, didWriteValueFor c: CBCharacteristic, error: Error?) {
        if let error { log("write failed: \(error.localizedDescription)"); manager.cancelPeripheralConnection(p); return }
        if c.uuid == dataID { writeData(p); return }
        guard !controlWrites.isEmpty else { return }
        let completed = controlWrites.removeFirst()
        if ProcessInfo.processInfo.environment["PUCKLING_BLE_DEBUG"] == "1" { log("wrote \(completed)") }
        // AUTH notifications can arrive before their write completion.
        if completed.first == 0x02 && phase == "begin" { phase = "data"; writeData(p) }
    }
    func writeData(_ p: CBPeripheral) {
        guard let blob = current, let d = data else { return }
        guard phase == "data" else { return }
        if offset < blob.count {
            let count = min(512, p.maximumWriteValueLength(for: .withResponse), blob.count - offset)
            p.writeValue(blob.subdata(in: offset..<(offset + count)), for: d, type: .withResponse); offset += count
        } else {
            phase = "commit"; send([0x03])
        }
    }
}
let app = Central()
app.start()
DispatchQueue.global().async {
    while let line = readLine() {
        if let blob = Data(base64Encoded: line) { DispatchQueue.main.async { app.enqueue(blob) } }
    }
    DispatchQueue.main.async { exit(0) }
}
RunLoop.main.run()
