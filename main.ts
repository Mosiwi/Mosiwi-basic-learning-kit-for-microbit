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

    /**
     * spi mode3, 16bit, MSBFIRST
     */
    function spiWrite(dat: number): number{ 
        let r: number = 0x0000;
        let i: number = 0;
        let bit: number = 0x8000;
        pins.digitalWritePin(DigitalPin.P13, 1);             //sck
        for(i = 0; i < 16; i++){
            pins.digitalWritePin(DigitalPin.P15, dat & bit); //mosi
            pins.digitalWritePin(DigitalPin.P13, 0);         //sck
            control.waitMicros(10);
            pins.digitalWritePin(DigitalPin.P13, 1);         //sck
            control.waitMicros(10);
            if (pins.digitalReadPin(DigitalPin.P14)) {       //miso
                r |= (0x0001 << (15 - i));
            }
            bit >>= 1;
            if(i == 7){
                control.waitMicros(15);
            }
        }
        return r;
    }

    function BC7278_spi_read_data(addr: number, dat: number): number {
        let r: number = 0;
        let data: number = addr * 256 + dat;
        r = spiWrite(data);
        return r;
    }

    function BC7278_spi_write_data(addr: number, dat: number) {
        let data: number = addr*256 + dat;
        spiWrite(data);
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
    // OnOff = 0 = on, OnOff = 1 = off
    function SetDisplaySeg(Seg: number, OnOff: number) {
        if (OnOff != 0 && OnOff != 1)
            return;
        Seg = (OnOff << 7) + Seg;
        BC7278_spi_write_data(SegAddReg, Seg);
    }

    ////////////////////////////////////////////
    //% block="Keypad-ready-pin"
    //% group="Digital-Tube_Button" weight=7
    export function Buton_pin() {
        return pins.digitalReadPin(DigitalPin.P11);     //P11
    }

    ////////////////////////////////////////////
    //            bit: 0 0 0  x x x x x
    // Read key value: 0 0 0 OK U D L R
    // x = 1, There's no button to press. 
    // x = 0, There are buttons to press.
    //% block="Get-keypad-value"
    //% group="Digital-Tube_Button" weight=6
    export function Read_button(): number{
        // 0xff: pseudoinstruction
        // Gets 16 key values
        let allKey: number = BC7278_spi_read_data(0xff, 0xff);

        // After processing data, obtain the key values of S11-S15.
        let keyValue: number = (~(allKey >> 11)) & 0x1f;
        basic.pause(28);
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
		let ty: number = 0;
        if (parseInt(num.toString()) == parseFloat(num.toString())) {  //integer
            dat = num;
            SetDisplaySeg(0x17, 1);           // Turn off the decimal point.
			ty = 0;
        }
        else {                                                          //flaot
            dat = ~~(num * 10);
            SetDisplaySeg(0x17, 0);           // Turn on the decimal point.
			ty = 1;
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
            Digital_Tube_Seg(0, 0x0);
            Digital_Tube_Num(1, ~~(dat / 100));
            Digital_Tube_Num(2, ~~(dat % 100 / 10));
            Digital_Tube_Num(3, dat % 10);
            return;
        }
    
        if (~~(dat / 10) != 0) {
            Digital_Tube_Seg(0, 0x0);
            Digital_Tube_Seg(1, 0x0);
            Digital_Tube_Num(2, ~~(dat / 10));
            Digital_Tube_Num(3, dat % 10);
            return;
        }
		
		if(ty == 0){
			Digital_Tube_Seg(0, 0x0);
			Digital_Tube_Seg(1, 0x0);
			Digital_Tube_Seg(2, 0x0);
			Digital_Tube_Num(3, dat);
		}else{
			Digital_Tube_Seg(0, 0x0);
			Digital_Tube_Seg(1, 0x0);
			Digital_Tube_Num(2, 0);
			Digital_Tube_Num(3, dat);
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
		let seg = (~Seg) & 0xff;
        switch (Position) {
            case 0: addr = DisReg0; break;
            case 1: addr = DisReg1; break;
            case 2: addr = DisReg2; break;
            case 3: addr = DisReg3; break;
            default: return;
        }
        BC7278_spi_write_data(addr, seg);
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
        let buffer_reg2 = pins.createBuffer(3);
        let buffer_read = pins.createBuffer(3);

        buffer_reg2[0] = reg;
        buffer_reg2[1] = 0x00;
        buffer_reg2[2] = 0x00;
        pins.i2cWriteBuffer(aht20Addr, buffer_reg2, false);
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
        let buffer_read2 = pins.createBuffer(6);
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
        buffer_read2 = pins.i2cReadBuffer(aht20Addr, 6, false);

        // buffer_read[0]  //Status word: the state is 0x98, indicating busy state, and bit[7] is 1.  The state is 0x1C, or 0x0C, or 0x08 is idle, and bit[7] is 0.
        // buffer_read[1]  //humidity
        // buffer_read[2]  //humidity
        // buffer_read[3]  //humidity / temperature
        // buffer_read[4]  //temperature
        // buffer_read[5]  //temperature
        RetuData = (RetuData | buffer_read2[1]) << 8;
        RetuData = (RetuData | buffer_read2[2]) << 8;
        RetuData = (RetuData | buffer_read2[3]);
        RetuData = RetuData >> 4;
        ct[0] = RetuData * 100 / 1024 / 1024;           //humidity 
        RetuData = 0;
        RetuData = (RetuData | buffer_read2[3]) << 8;
        RetuData = (RetuData | buffer_read2[4]) << 8;
        RetuData = (RetuData | buffer_read2[5]);
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
        let buffer_reg3 = pins.createBuffer(1);
        let result: number = 0;

        buffer_reg3[0] = sensor;
        pins.i2cWriteBuffer(address, buffer_reg3, true);
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
    //% block="Set buzzer volume $v"
	//% v.min=0 v.max=1023
    //% group="Buzzer" weight=1
    export function Buzzer_pin(v: number) {
        pins.analogWritePin(AnalogPin.P3, v)
    }


    ////////////////////////////////////////////
    //% block="Button_Pin"
    //% group="Button" weight=1
    export function Button_pin() {
        return pins.digitalReadPin(DigitalPin.P5);
    }

	/**
     * Read a byte of data from eeprom.
	 */
	//% shim=ds2431::Read_byte_from_ds2431
    //% block="Read data from $addr address"
    //% addr.min=0 addr.max=16
    //% group="Storer" weight=4
    export function EEPROM_read(addr: number): number{
        return 0;
    }

    /**
     * @param dat --> 0-255.
     * @param address --> 0-15
     */
    //% shim=ds2431::Write_8bytes_to_ds2431
    //% block="Write $dat to memory $addr address"
    //% dat.min=0 dat.max=255 addr.min=0 addr.max=15
    //% group="Storer" weight=3
	//% inlineInputMode=inline
    export function EEPROM_write(dat: number, addr: number) {
        return false;
    }

}
