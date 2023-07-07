/** Mosiwi-basic-learning-kit-for-microbit
* author: jalen
* github:https://github.com/mosiwi
* Write the date: 2023-6-30
*/
const enum segment {
   dp = 0b01111111,
    g = 0b10111111,
    f = 0b11011111,
    e = 0b11101111,
    d = 0b11110111,
    c = 0b11111011,
    b = 0b11111101,
    a = 0b11111110,
  ' ' = 0b11111111
}
const enum OnOff {
    On = 1,
    Off = 0
}
const enum RgbLedPin {
    R_Pin = 0,
    G_Pin = 1,
    B_Pin = 12
}
const enum Humiture {
    Temperature = 0,
    Humidity = 1
}
const enum Sensor {
    IR_receiver = 0x04,
    Microphone = 0x00,
    Potentiometer = 0x02
}
const enum Veer {
    CW = 0,
    CCW = 1
}

//% color="#3487FF" icon="\uf002" weight=15
//% groups="['Display-Buttom', 'Led', 'RGB-Led', 'Humiture', 'Ultrasonic', 'I2c-read', 'Fan', 'Buzzer', 'Button', 'Storer']"
namespace Mosiwi_basic_learning_kit {
    // Compute a Dallas Semiconductor 8 bit CRC directly.
    // this is much slower, but a little smaller, than the lookup table.
    // https://www.analog.com/en/technical-articles/understanding-and-using-cyclic-redundancy-checks-with-maxim-1wire-and-ibutton-products.html
    function crc8(addr: any[], len: number) {
        let i: number = 0;
        let a: number = 0;
        let crc: number = 0;
        while (len--) {
            crc ^= addr[a];
            a++;
            for (i = 0; i < 8; ++i) {
                // Anti-order CRC8
                // 1. X8+X5+X4+1 = 100110001 		  
                // 2. The calculation of reverse XOR is used : 100110001 ---> 100011001
                // 3. The lowest bit of data is not processed : 100011001 ---> 10001100
                //    (Move (discard) one bit if the lowest bit of both the data and the polynomial is 1)
                // 4. 10001100 = 0x8C
                if (crc & 0x01)
                    crc = (crc >> 1) ^ 0x8C;
                else
                    crc = (crc >> 1);
            }
        }
        return crc;
    }

    function crc16(input: any[], len: number) {
        let j: number = 0;
        let b: number = 0;
        let crc2: number = 0x0000;
        while (len--) {
            crc2 ^= input[b];
            b++;
            for (j = 0; j < 8; ++j) {
                // Anti-order CRC16
                // 1. X16+X15+X2+1 = 11000000000000101 		  
                // 2. The calculation of reverse XOR is used : 11000000000000101 ---> 10100000000000011
                // 3. The lowest bit of data is not processed : 10100000000000011 ---> 1010000000000001
                //    (Move (discard) one bit if the lowest bit of both the data and the polynomial is 1)
                // 4. 1010000000000001 = 0xA001
                if (crc2 & 0x01)
                    crc2 = (crc2 >> 1) ^ 0xA001;
                else
                    crc2 = (crc2 >> 1);
            }
        }
        return crc2;
    }


    // They correspond to 4-bit digital tube and can control 8 digital sections of the code tube.
    // default = 0xff, bit: on = 0, off = 1
    // D7  D6  D5  D4  D3  D2  D1  D0
    // DP  G   F   E   D   C   B   A
    const DisReg0 = 0x00;
    const DisReg1 = 0x01;
    const DisReg2 = 0x02;
    const DisReg3 = 0x03;

    // The user can input the value and get the digital display directly.
    // D7  D6  D5  D4  D3  D2  D1  D0
    // A3  A2  A1  A0  d3  d2  d1  d0
    // A3:A0 controls which digit bits are displayed.
    // d3:d0 = 0---F
    const DecReg = 0x1B;

    // Realize display control in unit of segment
    //    DP   G   F   E   D   C   B   A
    // 0  07   06  05  04  03  02  01  00
    // 1  0F   0F  0D  0C  0B  0A  09  08   
    // 2  17   16  15  14  13  12  11  10
    // 3  1F   1E  1D  1C  1B  1A  19  18
    // data format:
    // D7  D6  D5  D4  D3  D2  D1  D0
    // Seg A6  A5  A4  A3  A2  A1  A0
    // A5:A0 = data address, Seg = 0 = on, Seg = 1 = off  
    const SegAddReg = 0x1C;

    // Clear the screen or light up all leds.
    const GloReg = 0x1D;

    function BC7278_spi_read_data(addr: number, dat: number): number {
        let data: number = 0;
        data = pins.spiWrite(addr);
        data = ((data << 8) & 0xff00) + (pins.spiWrite(dat) & 0xff);
        return data;
    }

    function BC7278_spi_write_data(addr: number, dat: number) {
        pins.spiWrite(addr);
        pins.spiWrite(dat);
    }

    ////////////////////////////////////////////
    // display segment
    // Seg   DP    G    F    E    D    C    B    A
    // Bit 
    //  0    7h    6h   5h   4h   3h   2h   1h   0h
    //  1    fh    eh   dh   ch   bh   ah   9h   8h
    //  2    17h   16h  15h  14h  13h  12h  11h  10h
    //  3    1fh   1eh  1dh  1ch  1bh  1ah  19h  18h
    //  
    // OnOff = 1 = on, OnOff = 0 = off
    function SetDisplaySeg(Seg: number, OnOff: number) {
        if (OnOff != 0 && OnOff != 1)
            return;
        Seg = ((~OnOff) << 7) + Seg;
        BC7278_spi_write_data(SegAddReg, Seg);
    }

    /////////////////////////////////////////////////////
    //% block="Digital-tube-button-init"
    //% group="Digital-Tube_Button" weight=7
    export function Digital_Tube_Button_Init() {
        pins.spiPins(DigitalPin.P15, DigitalPin.P14, DigitalPin.P13);
        pins.spiFormat(8, 3);
        pins.spiFrequency(60000);
    }

    ////////////////////////////////////////////
    //% block="Keypad-interrupt-output"
    //% group="Digital-Tube_Button" weight=6
    export function Buton_pin() {
        return EventBusSource.MICROBIT_ID_BUTTON_B;     //P11
    }

    ////////////////////////////////////////////
    //            bit: 0 0 0  x x x x x
    // Read key value: 0 0 0 OK U D L R
    // x = 1, There's no button to press. 
    // x = 0, There are buttons to press.
    //% block="Get-keypad-value"
    //% group="Digital-Tube_Button" weight=6
    export function Read_button() {
        // 0xff: pseudoinstruction
        // Gets 16 key values
        let allKey: number = BC7278_spi_read_data(0xff, 0xff);

        // After processing data, obtain the key values of S11-S15.
        let keyValue: number = ((~allKey) >> 11) & 0x1f;

        return keyValue;
    }

    /////////////////////////////////////////////////////
    //% block="Digital-tube-clear"
    //% group="Digital-Tube_Button" weight=5
    export function Digital_Tube_Clear() {
        BC7278_spi_write_data(GloReg, 0xff);
    }

    ////////////////////////////////////////////
    // display: 0-9999 or 0.0-999.9
    //% block="Digital-tube-num: $num"
    //% group="Digital-Tube_Button" weight=4
    export function DisplayNumber(num: number) {
        let dat: number = 0;
        if (parseInt(num.toString()) == parseFloat(num.toString())) {  //integer
            dat = num;
            SetDisplaySeg(0x17, 0);           // Turn off the decimal point.
        }
        else {                                                          //flaot
            dat = ~~(num * 10);
            SetDisplaySeg(0x17, 1);           // Turn on the decimal point.
        }

        dat = dat % 10000;
        if (~~(dat / 1000) != 0) {
            Digital_Tube_Num(0, ~~(dat / 1000));
            Digital_Tube_Num(1, ~~(dat % 1000 / 100));
            Digital_Tube_Num(2, ~~(dat % 100 / 10));
            Digital_Tube_Num(3, dat % 10);
            return;
        }
        if (~~(dat / 100) != 0) {
            Digital_Tube_Seg(0, 0xff);
            Digital_Tube_Num(1, ~~(dat / 100));
            Digital_Tube_Num(2, ~~(dat % 100 / 10));
            Digital_Tube_Num(3, dat % 10);
            return;
        }
    
        if (~~(dat / 10) != 0) {
            Digital_Tube_Seg(0, 0xff);
            Digital_Tube_Seg(1, 0xff);
            Digital_Tube_Num(2, ~~(dat / 10));
            Digital_Tube_Num(3, dat % 10);
            return;
        }

        Digital_Tube_Seg(0, 0xff);
        Digital_Tube_Seg(1, 0xff);
        Digital_Tube_Seg(2, 0xff);
        Digital_Tube_Num(3, dat);
    }

    ////////////////////////////////////////////
    // display: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, A,  b,  C,  d,  E,  F
    // Number : 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15
    // Position : 0, 1, 2, 3
    //% block="Digital-Tube_Num: position $Position num $Number"
    //% Position.min=0 Position.max=3 Number.min=0 Number.max=9
    //% group="Digital-Tube_Button" weight=3
    export function Digital_Tube_Num(Position: number, Number: number) {
        if (Position > 3 || Number > 15)
            return;
        let dat2: number = 0;
        dat2 = (Position << 4) | Number;
        BC7278_spi_write_data(DecReg, dat2);
    }

    ////////////////////////////////////////////
    // segment
    // Seg = xxxxxxxx = DP, G, F, E, D, C, B, A (x=0=on, x=1=off)
    //% block="Segment: $Seg"
    //% group="Digital-Tube_Button" weight=2
    export function Segment(Seg: segment): number {
        return Seg;
    }

    ////////////////////////////////////////////
    // display segment
    // Position: 0--3
    // Seg = xxxxxxxx = DP, G, F, E, D, C, B, A (x=0=on, x=1=off)
    //% block="Digital-Tube_Seg: position $Position segment $Seg"
    //% Position.min=0 Position.max=3
    //% group="Digital-Tube_Button" weight=1
    export function Digital_Tube_Seg(Position: number, Seg: number) {
        let addr: number = 0;
        switch (Position) {
            case 0: addr = DisReg0; break;
            case 1: addr = DisReg1; break;
            case 2: addr = DisReg2; break;
            case 3: addr = DisReg3; break;
            default: return;
        }
        BC7278_spi_write_data(addr, Seg);
    }



    const LSBFIRST: number = 1;
    const MSBFIRST: number = 0;
    let ledData: number = 0;

    //////////////////////////////////////////////////////////////
    // Send 8-bit data to 74HC595.
    function ShiftOut(val: number) {
        let k: number;
        let bit: number = 0x80;
        for (k = 0; k < 8; k++) {
            pins.digitalWritePin(DigitalPin.P16, val & bit);
            bit = (bit >> 1) & 0xff;

            pins.digitalWritePin(DigitalPin.P8, 1);
            control.waitMicros(10);
            pins.digitalWritePin(DigitalPin.P8, 0);
            control.waitMicros(10);
        }
    }

    ////////////////////////////////////////////
    //% block="$Onoff"
    //% group="Led" weight=2
    export function On_Off(Onoff: OnOff): number {
        return Onoff;
    }

    ////////////////////////////////////////////
    // LED
    //% block="Set $Pos led  $OnOff"
    //% Pos.min=0 Pos.max=8 OnOff.min=0 OnOff.max=1
    //% group="Led" weight=1
    export function Set_Led(Pos: number, OnOff: number) {
        if (Pos > 8 || OnOff > 1) {
            return;
        }
        if (OnOff == 1) {
            ledData = ledData | (1 << (Pos - 1));
        }
        else {
            ledData = ledData & ((~(1 << (Pos - 1))) & 0xff);
        }
        //ground latchPin and hold low for as long as you are transmitting
        pins.digitalWritePin(DigitalPin.P9, 0);
        ShiftOut(ledData);
        //no longer needs to listen for information
        pins.digitalWritePin(DigitalPin.P9, 1);
    }



    ////////////////////////////////////////////
    //% block="RGB-LED $Pin PWM $pwm"
    //% pwm.min=0 pwm.max=1023
    //% group="RGB_Led" weight=1
    export function RgbLed_pin(Pin: RgbLedPin, pwm: number) {
        if (Pin == 0)
            pins.analogWritePin(AnalogPin.P0, pwm);
        else if (Pin == 1)
            pins.analogWritePin(AnalogPin.P1, pwm);
        else if (Pin == 12)
            pins.analogWritePin(AnalogPin.P12, pwm);
    }



    // AHT20 Register address		
    const reg1_ = 0x1b;
    const reg2_ = 0x1c;
    const reg3_ = 0x1e;
    const ac_ = 0xac;
    const ac_d1 = 0x33;
    const ac_d2 = 0x00;
    const aht20Addr = 0x38;
    let ct = [0, 0];

    ////////////////////////////////////////////
    function SendAC() {
        let buffer_reg = pins.createBuffer(3);
        buffer_reg[0] = ac_;
        buffer_reg[1] = ac_d1;
        buffer_reg[2] = ac_d2;
        pins.i2cWriteBuffer(aht20Addr, buffer_reg, false);
    }

    ////////////////////////////////////////////
    function Reset_REG(reg: number) {
        let buffer_reg = pins.createBuffer(3);
        let buffer_read = pins.createBuffer(3);

        buffer_reg[0] = reg;
        buffer_reg[1] = 0x00;
        buffer_reg[2] = 0x00;
        pins.i2cWriteBuffer(aht20Addr, buffer_reg, false);
        basic.pause(5);
        buffer_read = pins.i2cReadBuffer(aht20Addr, 3, false);
        basic.pause(10);
        buffer_read[0] = buffer_read[0] | reg;
        pins.i2cWriteBuffer(aht20Addr, buffer_read, false);
    }

    ////////////////////////////////////////////
    function Read_Status():number {
        let buffer_stat = pins.createBuffer(1);
        buffer_stat = pins.i2cReadBuffer(aht20Addr, 1, false);
        return buffer_stat[0];
    }

    ////////////////////////////////////////////
    //% block="Humiture_init"
    //% group="Humiture" weight=3
    ////////////////////////////////////////////
    export function AHT20_Init() {
        Reset_REG(reg1_);
        Reset_REG(reg2_);
        Reset_REG(reg3_);
    }

    ///////////////////////////////////////////
    //No CRC check, read AHT20 temperature and humidity data directly
    //% block="Read_humiture"
    //% group="Humiture" weight=2
    export function Read_CTdata() {
        let buffer_read = pins.createBuffer(6);
        let RetuData = 0;
        let cnt = 0;

        SendAC();                // Send the AC command to AHT20
        basic.pause(80);

        //Until bit[7] is 0, indicating idle state. If it is 1, indicating busy state
        while (((Read_Status() & 0x80) == 0x80)) {
            basic.pause(2);
            if (cnt++ >= 100) {
                return false;
            }
        }
        buffer_read = pins.i2cReadBuffer(aht20Addr, 6, false);

        // buffer_read[0]  //Status word: the state is 0x98, indicating busy state, and bit[7] is 1.  The state is 0x1C, or 0x0C, or 0x08 is idle, and bit[7] is 0.
        // buffer_read[1]  //humidity
        // buffer_read[2]  //humidity
        // buffer_read[3]  //humidity / temperature
        // buffer_read[4]  //temperature
        // buffer_read[5]  //temperature
        RetuData = (RetuData | buffer_read[1]) << 8;
        RetuData = (RetuData | buffer_read[2]) << 8;
        RetuData = (RetuData | buffer_read[3]);
        RetuData = RetuData >> 4;
        ct[0] = RetuData * 100 / 1024 / 1024;           //humidity 
        RetuData = 0;
        RetuData = (RetuData | buffer_read[3]) << 8;
        RetuData = (RetuData | buffer_read[4]) << 8;
        RetuData = (RetuData | buffer_read[5]);
        RetuData = RetuData & 0xfffff;
        ct[1] = RetuData * 200 / 1024 / 1024 - 50;        //temperature 
        return true;
    }

    ////////////////////////////////////////////
    //% block="$TH"
    //% group="Humiture" weight=1
    ////////////////////////////////////////////
    export function Humiture_data(TH: Humiture): number {
        if (TH == Humiture.Humidity) {
            return ct[0];
        }
        else {
            return ct[1];
        }
    }



    ////////////////////////////////////////////
    //% block="Ultrasonic(cm)"
    //% group="Ultrasonic" weight=1
    ////////////////////////////////////////////
    export function Ultrasonic_() {
        let t: number = 0;
        pins.digitalWritePin(DigitalPin.P0, 1);
        control.waitMicros(10);
        pins.digitalWritePin(DigitalPin.P0, 0);

        t = pins.pulseIn(DigitalPin.P1, PulseValue.High);
        return t / 29 / 2;
    }



    ////////////////////////////////////////////
    //% block="I2c-read $sensor"
    //% group="I2c_read" weight=1
    ////////////////////////////////////////////
    export function I2c_read(sensor: Sensor): number {
        let address: number = 0x2d;
        let buffer_result = pins.createBuffer(2);
        let buffer_reg = pins.createBuffer(1);
        let result: number = 0;

        buffer_reg[0] = sensor;
        pins.i2cWriteBuffer(address, buffer_reg, true);
        buffer_result = pins.i2cReadBuffer(address, 2, false);
        result = buffer_result[0]*256 + buffer_result[1];
        //pins.i2cWriteNumber(address, sensor, NumberFormat.UInt8LE, true);
        //result = pins.i2cReadNumber(address, NumberFormat.UInt16LE, false);
        return result & 0xffff;
    }



    ////////////////////////////////////////////
    //% block="Fan $_Veer speed $Speed"
    //% Speed.min=0 Speed.max=1023
    //% group="Fan" weight=1
    ////////////////////////////////////////////
    export function Fan_(_Veer: Veer, Speed: number) {
        if (_Veer == Veer.CW) {
            pins.digitalWritePin(DigitalPin.P0, 0);
            pins.analogWritePin(AnalogPin.P1, Speed)
        }
        else {
            pins.analogWritePin(AnalogPin.P0, Speed)
            pins.digitalWritePin(DigitalPin.P1, 0);
        }
    }


    ////////////////////////////////////////////
    //% block="Buzzer_Pin"
    //% group="Buzzer" weight=1
    export function Buzzer_pin() {
        return DigitalPin.P3;
    }


    ////////////////////////////////////////////
    //% block="Button_Pin"
    //% group="Button" weight=1
    export function Button_pin() {
        return DigitalPin.P5;
    }


    // Perform the onewire reset function.  We will wait up to 250uS for
    // the bus to come high, if it doesn't then it is broken or shorted
    // and we return a 0;
    // Returns 1 if a device asserted a presence pulse, 0 otherwise.
    function OneWire_reset(): number {
        let r: number;
        let retries: number = 125;
        // wait until the wire is high... just in case
        do {
            if (--retries == 0) return 0;
            control.waitMicros(2);
        } while (!pins.digitalReadPin(DigitalPin.P2));

        pins.digitalWritePin(DigitalPin.P2, 0);
        control.waitMicros(480);
        pins.digitalWritePin(DigitalPin.P2, 1);
        control.waitMicros(60+10);
        r = pins.digitalReadPin(DigitalPin.P2);
        control.waitMicros(410);
        return r;
    }

    // Write a bit. Port and bit is used to cut lookup time and provide
    // more certain timing.
    function OneWire_write_bit(v: number) {
        if ((v & 0x01) != 0) {   // write bit 1	
            pins.digitalWritePin(DigitalPin.P2, 0);
            control.waitMicros(10);  
            pins.digitalWritePin(DigitalPin.P2, 1);
            control.waitMicros(55);  
        } else {      // write bit 0
            pins.digitalWritePin(DigitalPin.P2, 0);
            control.waitMicros(65);  
            pins.digitalWritePin(DigitalPin.P2, 1);
            control.waitMicros(5);  
        }
    }

    // Read a bit. Port and bit is used to cut lookup time and provide
    // more certain timing.
    function OneWire_read_bit(): number {
        let s: number;
        pins.digitalWritePin(DigitalPin.P2, 0);
        control.waitMicros(5); 
        pins.digitalReadPin(DigitalPin.P2);
        control.waitMicros(10);
        s = pins.digitalReadPin(DigitalPin.P2);
        control.waitMicros(55); 
        return s;
    }

    // Write a byte. 
    function OneWire_write_byte(dat: number) {
        let bitMask: number;
        for (bitMask = 0x01; (bitMask & 0xff) < 0x80; bitMask <<= 1) {
            //OneWire_write_bit((bitMask & v) ? 1 : 0);
            if ((dat & bitMask) != 0)
                OneWire_write_bit(1);
            else
                OneWire_write_bit(0);
        }
    }

    // Read a byte
    function OneWire_read_byte(): number {
        let bitMask: number;
        let u: number = 0;
        for (bitMask = 0x01; (bitMask & 0xff) < 0x80; bitMask <<= 1) {
            if (OneWire_read_bit() != 0) u |= bitMask;
        }
        return u;
    }



    let ROM_NUM = [0, 0, 0, 0, 0, 0, 0, 0];
    ////////////////////////////////////////////
    //% block="Search_device"
    //% group="Storer" weight=6
    export function EEPROM_search_ROM() {
        let id_bit: number = 0;
        let cmp_id_bit: number = 0;
        let c: number = 0;
        let l: number = 0;

        for (l = 0; l < 8; l++)
            ROM_NUM[l] = 0;

        //pins.setPull(DigitalPin.P2, PinPullMode.PullUp)
        // The device will be reset and found.
        // If the device is not found, return false.
        if (!OneWire_reset())
            return false;

        OneWire_write_byte(0xF0);     // Search ROM

        do {
            // read a bit and its complement
            id_bit = OneWire_read_bit();
            cmp_id_bit = OneWire_read_bit();
            // check for no devices on 1-wire
            if ((id_bit == 1) && (cmp_id_bit == 1)) {
                return false;
            } else {
                if ((id_bit == 0) && (cmp_id_bit == 0))
                    // Multiple devices found on 1-wire
                    return false;
            }
            if (id_bit)
                ROM_NUM[c / 8] |= (0x01 << (c % 8)) & 0xff;

            OneWire_write_bit(id_bit);
            c++;
        } while (c < 64);
        basic.showNumber(1);
        // A device was found but the serial number CRC is invalid.
        if (crc8(ROM_NUM, 7) != ROM_NUM[7])
            return false;

        // Family code error
        if (ROM_NUM[0] != 0x2D)
            return false;

        return true;
    }

    function EEPROM_check_crc16(input: any[], len: number, inverted_crc: any[]) {
        let crc3: number = ~crc16(input, len);
        return (crc3 & 0xFF) == inverted_crc[0] && (crc3 >> 8) == inverted_crc[1];
    }

    // slect ROM
    function EEPROM_slect_rom() {
        let m: number = 0;
        OneWire_reset();              // initial signal
        OneWire_write_byte(0x55);     // Match ROM
        for (m = 0; m < 8; m++)
            OneWire_write_byte(ROM_NUM[m]);
    }

    ////////////////////////////////////////////
    //% block="Get_ROM"
    //% group="Storer" weight=5
    export function Return_ROM(): any {
        return ROM_NUM;
    }

    // Read a byte of data from eeprom.
    //% block="Read data from $address"
    //% address.min=0 address.max=16
    //% group="Storer" weight=4
    export function EEPROM_read(address: number) {
        address = address * 8;
        EEPROM_slect_rom();              // Match ROM
        OneWire_write_byte(0xF0);     // read memory
        OneWire_write_byte(address & 0x00ff);
        OneWire_write_byte((address & 0xff00) >> 8);
        return OneWire_read_byte();
    }

    /**
     * Write a 8-byte row, must write 8 bytes at a time.
     * @param buf --> An array of 8 members.
     * @param address
     */
    //% block="Write array $buf to $address"
    //% address.min=0 address.max=15
    //% group="Storer" weight=3
    export function EEPROM_write(buf: any[], address: number) {
        let verify: boolean = false;
        let crc16 = [0, 0];    // store value of crc
        let buffer = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];       // data)+command = 12bytes
        let n: number = 0;

        // 1.write scratchpad --> Write data to the scratchpad
        buffer[0] = 0x0F;                   // store commands --> write scratchpad
        buffer[1] = address & 0x00ff;       // address
        buffer[2] = (address & 0xff00) >> 8;
        for (n = 0; n < 8; n++) {
            buffer[n + 3] = buf[n];         // 8 bytes data
        }

        EEPROM_slect_rom();                        // Match ROM
        OneWire_write_byte(buffer[0]);          // CMD ---> write scratchpad
        OneWire_write_byte(buffer[1]);          // address
        OneWire_write_byte(buffer[2]);

        for (n = 3; n < 11; n++)  // write 8 bytes data to eeprom
            OneWire_write_byte(buffer[n]);

        crc16[0] = OneWire_read_byte();         // Read CRC-16
        crc16[1] = OneWire_read_byte();
        if (!EEPROM_check_crc16(buffer, 11, crc16))
            verify = true; //CRC not matching, try to read again

        // 2.read scratchpad --> Read data from the scratchpad
        buffer[0] = 0xAA;                   // store commands --> read scratchpad
        EEPROM_slect_rom();                        // Match ROM
        OneWire_write_byte(buffer[0]);          // CMD ---> read scratchpad

        for (n = 1; n < 4; n++)            //Read TA1(Low address), TA2(High address) and E/S
            buffer[n] = OneWire_read_byte();

        if (buffer[3] != 0x07)              // E/S must be equal to 0x07(8 bytes data)
            return false;

        if (verify) {
            for (n = 4; n < 12; n++) //Read the data of scratchpad(8 bytes)
                buffer[n] = OneWire_read_byte();

            crc16[0] = OneWire_read_byte();        // Read CRC-16
            crc16[1] = OneWire_read_byte();
            if (!EEPROM_check_crc16(buffer, 12, crc16))  // CRC not matching.
                return false;
        }

        // 3.Copy scratchpad --> Write the data in the scratchpad to memory
        buffer[0] = 0x55;          // CMD --> Copy scratchpad
        EEPROM_slect_rom();               // Match ROM
        for (n = 0; n < 4; n++)   //Send authorization code (TA1, TA2, E/S)
            OneWire_write_byte(buffer[n]);

        basic.pause(15);                 // t_PROG = 12.5ms worst case.
        let res: number = OneWire_read_byte();  // Read copy status, 0xAA = success
        if (res != 0xAA) {
            return false;
        }
        return true;
    }
}
