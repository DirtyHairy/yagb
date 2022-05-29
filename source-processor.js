export class SampleQueue{constructor(t){this.capacity=t,this.channelLeftData=new Float32Array(this.capacity),this.channelRightData=new Float32Array(this.capacity),this.length=0,this.nextSample=0}push(t,e){this.channelLeftData[this.nextSample]=t,this.channelRightData[this.nextSample]=e,this.length<this.capacity&&this.length++,this.nextSample=(this.nextSample+1)%this.capacity}fill(t,e){const s=t.length;if(s!==e.length)return;let h=(this.nextSample-this.length+this.capacity)%this.capacity;for(let a=0;a<s&&this.length>0;a++)this.length>0&&(t[a]=this.channelLeftData[h],e[a]=this.channelRightData[h],h=(h+1)%this.capacity,this.length--)}}class SourceProcessor extends AudioWorkletProcessor{constructor(t){super(),this.sampleRate=t.processorOptions.sampleRate,this.prebuffer=t.processorOptions.prebuffer,this.queue=new SampleQueue(this.sampleRate),this.lastSampleLeft=this.lastSampleRight=0,this.port.onmessage=t=>{const e=t.data;for(let t=0;t<e.length;t++)this.queue.push(e.left[t],e.right[t]);this.port.postMessage(e,[e.left.buffer,e.right.buffer])}}process(t,e){return 1!==e.length||2!==e[0].length||(this.queue.length<this.prebuffer+e[0][0].length?(e[0][0].fill(this.lastSampleLeft),e[0][1].fill(this.lastSampleRight),!0):(this.queue.fill(e[0][0],e[0][1]),this.lastSampleLeft=e[0][1][e[0][1].length-1],this.lastSampleRight=e[0][1][e[0][1].length-1],!0))}}registerProcessor("source-processor",SourceProcessor);