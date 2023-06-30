// Mosiwi-basic-learning-kit-for-microbit
// author: jalen
// github:https://github.com/mosiwi
// Write the date: 2023-6-30

const enum segment {
    dp = 0b10000000,
    g = 0b01000000,
    f = 0b00100000,
    e = 0b00010000,
    d = 0b00001000,
    c = 0b00000100,
    b = 0b00000010,
    a = 0b00000001,
    ' ' = 0b00000000
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
    IR_receiver = 0x00,
    Microphone = 0x02,
    Potentiometer = 0x04
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
        let i: number = 0;
        let a: number = 0;
        let crc: number = 0x0000;
        while (len--) {
            crc ^= input[a];
            a++;
            for (i = 0; i < 8; ++i) {
                // Anti-order CRC16
                // 1. X16+X15+X2+1 = 11000000000000101 		  
                // 2. The calculation of reverse XOR is used : 11000000000000101 ---> 10100000000000011
                // 3. The lowest bit of data is not processed : 10100000000000011 ---> 1010000000000001
                //    (Move (discard) one bit if the lowest bit of both the data and the polynomial is 1)
                // 4. 1010000000000001 = 0xA001
                if (crc & 0x01)
                    crc = (crc >> 1) ^ 0xA001;
                else
                    crc = (crc >> 1);
            }
        }
        return crc;
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

    function BC7278_spi_read_data(addr: number, dat: number) {
        let data: number = (addr << 8) + dat;
        data = pins.spiWrite(data);
        return data;
    }

    function BC7278_spi_write_data(addr: number, dat: number) {
        let data: number = (addr << 8) + dat;
        pins.spiWrite(data);
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
    //% block="Digital-Tube-Button_Init"
    //% group="Digital-Tube_Button" weight=7
    export function Digital_Tube_Button_Init() {
        pins.spiPins(15, 14, 13);
        pins.spiFormat(8, 3);
        pins.spiFrequency(60000);
    }

    ////////////////////////////////////////////
    //% block="Button_Interrupt-pin"
    //% group="Digital-Tube_Button" weight=6
    export function Buton_pin() {
        return 11;
    }

    ////////////////////////////////////////////
    //            bit: 0 0 0  x x x x x
    // Read key value: 0 0 0 OK U D L R
    // x = 1, There's no button to press. 
    // x = 0, There are buttons to press.
    //% block="Button"
    //% group="Digital-Tube_Button" weight=6
    export function Read_button(DG: number, Dat: number) {
        // 0xff: pseudoinstruction
        // Gets 16 key values
        let AllKey: number = BC7278_spi_read_data(0xff, 0xff);
        // Serial.println(AllKey, HEX);

        // After processing data, obtain the key values of S12-S15.
        let keyValue: number = (~AllKey) >> 11;
        // Serial.println(keyValue, HEX);

        return keyValue;
    }

    /////////////////////////////////////////////////////
    //% block="Digital-Tube_Clear"
    //% group="Digital-Tube_Button" weight=5
    export function Digital_Tube_Clear() {
        BC7278_spi_write_data(GloReg, 0xff);
    }

    ////////////////////////////////////////////
    // display: 0-9999 or 0.0-999.9
    //% block="Digital-Tube_Num: $num"
    //% group="Digital-Tube_Button" weight=4
    export function DisplayNumber(num: number) {
        let dat: number = 0;
        let i_f: number = 0;
        if (parseInt(num.toString()) == parseFloat(num.toString())) {  //integer
            i_f = 0;
            SetDisplaySeg(0x17, 0);           // Turn off the decimal point.
        }
        else {                                                          //flaot
            i_f = 1;
            dat = ~~(num * 10);
            SetDisplaySeg(0x17, 1);           // Turn on the decimal point.
        }

        //Digital_Tube_Seg(0x17, 0);          // Turn off the decimal point.
        if (dat / 1000 != 0) {
            Digital_Tube_Num(0, dat / 1000);
            Digital_Tube_Num(1, dat % 1000 / 100);
            Digital_Tube_Num(2, dat % 100 / 10);
            Digital_Tube_Num(3, dat % 10);
            return;
        }
        if (dat % 1000 / 100 != 0) {
            Digital_Tube_Seg(0, 0xff);
            Digital_Tube_Num(1, dat % 1000 / 100);
            Digital_Tube_Num(2, dat % 100 / 10);
            Digital_Tube_Num(3, dat % 10);
            return;
        }

        if (i_f == 0) {
            if (dat % 1000 / 10 != 0) {
                Digital_Tube_Seg(0, 0xff);
                Digital_Tube_Seg(1, 0xff);
                Digital_Tube_Num(2, dat % 100 / 10);
                Digital_Tube_Num(3, dat % 10);
                return;
            }
            Digital_Tube_Seg(0, 0xff);
            Digital_Tube_Seg(1, 0xff);
            Digital_Tube_Seg(2, 0xff);
            Digital_Tube_Num(3, dat % 10);
        }
        else {
            Digital_Tube_Seg(0, 0xff);
            Digital_Tube_Seg(1, 0xff);
            Digital_Tube_Num(2, dat % 100 / 10);
            Digital_Tube_Num(3, dat % 10);
        }
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
        let dat: number = 0;
        dat = (Position << 4) | Number;
        BC7278_spi_write_data(DecReg, dat);
    }

    ////////////////////////////////////////////
    // segment
    // Seg = xxxxxxxx = DP, G, F, E, D, C, B, A (x=0=on, x=1=off)
    //% block="Segment: $Seg"
    //% group="Digital-Tube_Button" weight=2
    export function Segment(Seg: segment) {
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
    // bitOrder: MSBFIRST or LSBFIRST
    function ShiftOut(bitOrder: number, val: number) {
        let i: number;
        for (i = 0; i < 8; i++) {
            if (bitOrder == LSBFIRST) {
                pins.digitalWritePin(16, val & 1);
                val >>= 1;
            } else {
                pins.digitalWritePin(16, val & 128);
                val <<= 1;
            }
            pins.digitalWritePin(8, 1);
            control.waitMicros(10);
            pins.digitalWritePin(8, 0);
            control.waitMicros(10);
        }
    }

    ////////////////////////////////////////////
    //% block="$Onoff"
    //% group="Led" weight=2
    export function On_Off(Onoff: OnOff) {
        return Onoff;
    }

    ////////////////////////////////////////////
    // LED
    //% block="Set $Pos led  $OnOff"
    //% Pos.min=1 Pos.max=8 OnOff.min=0 OnOff.max=1
    //% group="Led" weight=1
    export function Set_Led(Pos: number, OnOff: number) {
        if (Pos > 8 || OnOff > 1) {
            return;
        }
        if (OnOff == 1) {
            ledData = ledData | (1 << (Pos - 1));
        }
        else {
            ledData = ledData & (~(1 << (Pos - 1)));
        }
        //ground latchPin and hold low for as long as you are transmitting
        pins.digitalWritePin(9, 0);
        ShiftOut(MSBFIRST, ledData);
        //no longer needs to listen for information
        pins.digitalWritePin(9, 1);
    }



    ////////////////////////////////////////////
    //% block="$Pin"
    //% group="RGB_Led" weight=1
    export function RgbLed_pin(Pin: RgbLedPin) {
        return Pin;
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
        pins.i2cWriteNumber(aht20Addr, ac_, NumberFormat.Int8LE, true);
        pins.i2cWriteNumber(aht20Addr, ac_d1, NumberFormat.Int8LE, true);
        pins.i2cWriteNumber(aht20Addr, ac_d2, NumberFormat.Int8LE, false);
    }

    ////////////////////////////////////////////
    function Reset_REG(reg: number) {
        let Byte = [0, 0, 0];

        pins.i2cWriteNumber(aht20Addr, reg, NumberFormat.Int8LE, true);
        pins.i2cWriteNumber(aht20Addr, 0x00, NumberFormat.Int8LE, true);
        pins.i2cWriteNumber(aht20Addr, 0x00, NumberFormat.Int8LE, false);

        basic.pause(5);
        Byte[0] = pins.i2cReadNumber(aht20Addr, NumberFormat.Int8LE, true);
        Byte[1] = pins.i2cReadNumber(aht20Addr, NumberFormat.Int8LE, true);
        Byte[2] = pins.i2cReadNumber(aht20Addr, NumberFormat.Int8LE, false);

        basic.pause(10);
        pins.i2cWriteNumber(aht20Addr, 0xb0 | reg, NumberFormat.Int8LE, true);
        pins.i2cWriteNumber(aht20Addr, Byte[1], NumberFormat.Int8LE, true);
        pins.i2cWriteNumber(aht20Addr, Byte[2], NumberFormat.Int8LE, false);
    }

    ////////////////////////////////////////////
    function Read_Status() {
        let stat;
        stat = pins.i2cReadNumber(aht20Addr, NumberFormat.Int8LE, false);
        return stat;
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
        let Byte = [0, 0, 0, 0, 0, 0];
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
        Byte[0] = pins.i2cReadNumber(aht20Addr, NumberFormat.Int8LE, true);
        Byte[1] = pins.i2cReadNumber(aht20Addr, NumberFormat.Int8LE, true);
        Byte[2] = pins.i2cReadNumber(aht20Addr, NumberFormat.Int8LE, true);
        Byte[3] = pins.i2cReadNumber(aht20Addr, NumberFormat.Int8LE, true);
        Byte[4] = pins.i2cReadNumber(aht20Addr, NumberFormat.Int8LE, true);
        Byte[5] = pins.i2cReadNumber(aht20Addr, NumberFormat.Int8LE, false);

        // Byte[0]  //Status word: the state is 0x98, indicating busy state, and bit[7] is 1.  The state is 0x1C, or 0x0C, or 0x08 is idle, and bit[7] is 0.  
        // Byte[1]  //humidity 
        // Byte[2]  //humidity 
        // Byte[3]  //humidity / temperature
        // Byte[4]  //temperature 
        // Byte[5]  //temperature 
        RetuData = (RetuData | Byte[1]) << 8;
        RetuData = (RetuData | Byte[2]) << 8;
        RetuData = (RetuData | Byte[3]);
        RetuData = RetuData >> 4;
        ct[0] = RetuData * 100 / 1024 / 1024;           //humidity 
        RetuData = 0;
        RetuData = (RetuData | Byte[3]) << 8;
        RetuData = (RetuData | Byte[4]) << 8;
        RetuData = (RetuData | Byte[5]);
        RetuData = RetuData & 0xfffff;
        ct[1] = RetuData * 200 / 1024 / 1024 - 50;        //temperature 
        return true;
    }

    ////////////////////////////////////////////
    //% block="$TH"
    //% group="Humiture" weight=1
    ////////////////////////////////////////////
    export function Humiture_data(TH: Humiture) {
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

        pins.digitalWritePin(0, 1);
        control.waitMicros(10);
        pins.digitalWritePin(0, 0);

        t = pins.pulseIn(DigitalPin.P1, PulseValue.High);
        return t / 29 / 2;
    }



    ////////////////////////////////////////////
    //% block="I2c-read $sensor"
    //% group="I2c_read" weight=1
    ////////////////////////////////////////////
    export function I2c_read(sensor: Sensor) {
        let address: number = 0x2d;
        let result: number = 0;
        pins.i2cWriteNumber(address, sensor, NumberFormat.Int8LE, true);
        result = pins.i2cReadNumber(address, NumberFormat.Int8LE, true);
        result = result * 256 + pins.i2cReadNumber(address, NumberFormat.Int8LE, false);
        return result;
    }



    ////////////////////////////////////////////
    //% block="Fan $_Veer speed $Speed"
    //% Speed.min=0 Speed.max=1023
    //% group="Fan" weight=1
    ////////////////////////////////////////////
    export function Fan_(_Veer: Veer, Speed: number) {
        if (_Veer == Veer.CW) {
            pins.digitalWritePin(0, 0);
            pins.analogWritePin(1, Speed)
        }
        else {
            pins.analogWritePin(0, Speed)
            pins.digitalWritePin(1, 0);
        }
    }


    ////////////////////////////////////////////
    //% block="Buzzer_Pin"
    //% group="Buzzer" weight=1
    export function Buzzer_pin() {
        return 3;
    }


    ////////////////////////////////////////////
    //% block="Button_Pin"
    //% group="Button" weight=1
    export function Button_pin() {
        return 5;
    }


    // Perform the onewire reset function.  We will wait up to 250uS for
    // the bus to come high, if it doesn't then it is broken or shorted
    // and we return a 0;
    // Returns 1 if a device asserted a presence pulse, 0 otherwise.
    function OneWire_reset() {
        let r: number;
        let retries: number = 125;
        // wait until the wire is high... just in case
        do {
            if (--retries == 0) return 0;
            control.waitMicros(2);
        } while (!pins.digitalReadPin(DigitalPin.P7));

        pins.digitalWritePin(DigitalPin.P7, 0);
        control.waitMicros(550);
        r = pins.digitalReadPin(DigitalPin.P7);
        control.waitMicros(410);
        return r;
    }

    // Write a bit. Port and bit is used to cut lookup time and provide
    // more certain timing.
    function OneWire_write_bit(v: number) {
        if (v & 1) {   // write bit 1	
            pins.digitalWritePin(DigitalPin.P7, 0);
            control.waitMicros(10);
            pins.digitalWritePin(DigitalPin.P7, 1);
            control.waitMicros(55);
        } else {      // write bit 0
            pins.digitalWritePin(DigitalPin.P7, 0);
            control.waitMicros(65);
            pins.digitalWritePin(DigitalPin.P7, 1);
            control.waitMicros(5);
        }
    }

    // Read a bit. Port and bit is used to cut lookup time and provide
    // more certain timing.
    function OneWire_read_bit() {
        let r: number;
        pins.digitalWritePin(DigitalPin.P7, 0);
        control.waitMicros(13);
        r = pins.digitalReadPin(DigitalPin.P7);
        control.waitMicros(53);
        return r;
    }

    // Write a byte. 
    function OneWire_write_byte(v: number) {
        let bitMask: number;
        for (bitMask = 0x01; bitMask; bitMask <<= 1) {
            OneWire_write_bit((bitMask & v) ? 1 : 0);
        }
    }

    // Read a byte
    function OneWire_read_byte() {
        let bitMask: number;
        let r: number = 0;
        for (bitMask = 0x01; bitMask; bitMask <<= 1) {
            if (OneWire_read_bit()) r |= bitMask;
        }
        return r;
    }



    let ROM_NUM = [0, 0, 0, 0, 0, 0, 0, 0];
    ////////////////////////////////////////////
    //% block="Search_device"
    //% group="Storer" weight=6
    export function EEPROM_search_ROM() {
        let id_bit: number = 0;
        let cmp_id_bit: number = 0;
        let b: number = 0;
        let i: number = 0;

        for (i = 0; i < 8; i++)
            ROM_NUM[i] = 0;

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
                ROM_NUM[b / 8] |= 0x01 << (b % 8);

            OneWire_write_bit(id_bit);
            b++;
        } while (b < 64);

        // A device was found but the serial number CRC is invalid.
        if (crc8(ROM_NUM, 7) != ROM_NUM[7])
            return false;

        // Family code error
        if (ROM_NUM[0] != 0x2D)
            return false;

        return true;
    }

    function EEPROM_check_crc16(input: any[], len: number, inverted_crc: any[]) {
        let crc: number = ~crc16(input, len);
        return (crc & 0xFF) == inverted_crc[0] && (crc >> 8) == inverted_crc[1];
    }

    // slect ROM
    function EEPROM_slect_rom() {
        let i: number = 0;
        OneWire_reset();              // initial signal
        OneWire_write_byte(0x55);     // Match ROM
        for (i = 0; i < 8; i++)
            OneWire_write_byte(ROM_NUM[i]);
    }

    ////////////////////////////////////////////
    //% block="Get_device"
    //% group="Storer" weight=5
    export function Return_ROM() {
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
        let i: number = 0;

        // 1.write scratchpad --> Write data to the scratchpad
        buffer[0] = 0x0F;                   // store commands --> write scratchpad
        buffer[1] = address & 0x00ff;       // address
        buffer[2] = (address & 0xff00) >> 8;
        for (i = 0; i < 8; i++) {
            buffer[i + 3] = buf[i];         // 8 bytes data
        }

        EEPROM_slect_rom();                        // Match ROM
        OneWire_write_byte(buffer[0]);          // CMD ---> write scratchpad
        OneWire_write_byte(buffer[1]);          // address
        OneWire_write_byte(buffer[2]);

        for (i = 3; i < 11; i++)  // write 8 bytes data to eeprom
            OneWire_write_byte(buffer[i]);

        crc16[0] = OneWire_read_byte();         // Read CRC-16
        crc16[1] = OneWire_read_byte();
        if (!EEPROM_check_crc16(buffer, 11, crc16))
            verify = true; //CRC not matching, try to read again

        // 2.read scratchpad --> Read data from the scratchpad
        buffer[0] = 0xAA;                   // store commands --> read scratchpad
        EEPROM_slect_rom();                        // Match ROM
        OneWire_write_byte(buffer[0]);          // CMD ---> read scratchpad

        for (i = 1; i < 4; i++)            //Read TA1(Low address), TA2(High address) and E/S
            buffer[i] = OneWire_read_byte();

        if (buffer[3] != 0x07)              // E/S must be equal to 0x07(8 bytes data)
            return false;

        if (verify) {
            for (i = 4; i < 12; i++) //Read the data of scratchpad(8 bytes)
                buffer[i] = OneWire_read_byte();

            crc16[0] = OneWire_read_byte();        // Read CRC-16
            crc16[1] = OneWire_read_byte();
            if (!EEPROM_check_crc16(buffer, 12, crc16))  // CRC not matching.
                return false;
        }

        // 3.Copy scratchpad --> Write the data in the scratchpad to memory
        buffer[0] = 0x55;          // CMD --> Copy scratchpad
        EEPROM_slect_rom();               // Match ROM
        for (i = 0; i < 4; i++)   //Send authorization code (TA1, TA2, E/S)
            OneWire_write_byte(buffer[i]);

        basic.pause(15);                 // t_PROG = 12.5ms worst case.
        let res: number = OneWire_read_byte();  // Read copy status, 0xAA = success
        if (res != 0xAA) {
            return false;
        }
        return true;
    }
}