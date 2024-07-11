import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { TopicService } from 'src/app/services/topic.service';
import { blobToSrc, showErrors } from 'src/app/utils';
import {FormBuilder, Validators} from "@angular/forms"
import { ChatService } from 'src/app/services/chat.service';
import { FileService } from 'src/app/services/file.service';
import { WebsocketService } from 'src/app/services/websocket.service';
import * as RecordRTC from 'recordrtc';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss']
})
export class ChatComponent implements OnInit {
  messages:any[] = [

  ]
  topic_id:any;
  topic_info:any
  is_data_loading = false;
  chat_form:any
  recording :boolean = false;; // Indicates whether recording is in progress
  is_response_being_generated = false; // Indicates whether a response is being generated
  //session mode chat or query
  session_mode:any = "chat"
  current_session_id:any;
  is_session_created = false;
  //loader var for context reset event
  is_reseting_context = false;

  messageHolder : string = "Type your message here!"
  //pdf viewer input vars
  pdfSrc:any = null
  activeBbox:any
  currentPage = 1
  current_file_id = null;

  //holds the current instnace
  current_instance:any

  show_pdf_loader = false;

  // MediaStream object used for audio/video recording.
  mediaStream: MediaStream
  audioBlob:any;
  recorder: any; //any Recorder object
  websocket: WebSocket; //WebSocket object for server communication

  @ViewChild("chat_container") private chat_container:any;

  constructor(
    private route:ActivatedRoute,
    private topicService:TopicService,
    private toastService:ToastrService,
    private formBuilder:FormBuilder,
    private chatService:ChatService,
    private fileService:FileService,
    private websocketService: WebsocketService
  ) { }

  chat_text = " ";
  ngOnInit(): void {
    // Create chat form
    this.init_chat_form();
    // Get topic id from route param
    this.topic_id = this.route.snapshot.paramMap.get('topic_id');
    // Fetch topic info
    this.get_topic_info();
    // Create session
    this.create_session();
    // Check if RecordRTC is available
    if (typeof RecordRTC !== 'undefined') {
      console.log('RecordRTC is available');
    } else {
      console.error('RecordRTC is not available');
    }
  

  // Subscribe to WebSocket messages
  this.websocketService.messages$.subscribe((message: any) => {
    console.log("Received transcription:", message);
    this.chat_text += message;
    this.chat_form.controls['prompt'].setValue(this.chat_text);
  });

  // Subscribe to WebSocket status
  this.websocketService.status$.subscribe((status: boolean) => {
    if (!status){
      console.log("WebSocket connection closed")
    } else{
      console.log("WebSocket connection opened")
    }

  });
}

  
  // Method to start recording audio
  async initiateRecording() {
    console.log('Starting recording...');
    this.websocketService.connect();

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true }); // Get user media

      // Check if RecordRTC and StereoAudioRecorder are defined
      if (typeof RecordRTC === 'undefined' || typeof RecordRTC.StereoAudioRecorder === 'undefined') {
        console.error('RecordRTC or StereoAudioRecorder is not defined.');
        return;
      }

      this.recorder = new RecordRTC(this.mediaStream, {
        type: 'audio',
        mimeType: 'audio/pcm', // Ensure PCM encoding
        recorderType: RecordRTC.StereoAudioRecorder,
        desiredSampRate: 16000,
        numberOfAudioChannels: 1,
        timeSlice: 200, // Chunk size in milliseconds (200ms for 16000 Hz)
        ondataavailable: (blob: Blob) => {
          console.log('Sending audio data of size: ', blob.size, ' bytes');
          blob.arrayBuffer().then(buffer => {
            this.websocketService.sendMessage(buffer);
          });
        }
      });

      if (this.recorder && typeof this.recorder.startRecording === 'function') {
        this.recorder.startRecording(); // Start recording
        this.recording = true;
        this.messageHolder = 'Listening...';
      } else {
        console.error('Recorder is not properly initialized.');
      }
    } catch (error) {
      console.error('Error accessing media devices or starting recording.', error);
    }
  }

  // Method to stop recording audio
  stopRecording() {
    console.log('Stopping recording...');
    if (this.recorder && typeof this.recorder.stopRecording === 'function') {
      this.recorder.stopRecording(() => {
        let blob = this.recorder.getBlob(); // Get the recorded audio blob
        this.recorder.destroy(); // Destroy the recorder instance
        this.recorder = null;
        this.chat_text = " ";
      });
    } else {
      console.error('Recorder is not properly initialized.');
    }

    this.websocketService.close();

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop()); // Stop all media tracks
    }

    this.recording = false;
    this.messageHolder = 'Type your message here!';
  }

      
  get show_refresh_context_btn(){
    return this.session_mode == "chat"
  }


  init_chat_form(){
    let fields = {
      prompt :["", Validators.required]
    }
    this.chat_form = this.formBuilder.group(fields)
  }


  get_topic_info(){
    this.topicService.get_topic_details(this.topic_id).subscribe({
      next:(data)=>{
        this.topic_info = data;
      },
      error:(err)=>{
        //hide loader
        this.is_data_loading = false;
        showErrors(err, this.toastService)
      },
      complete:()=>{
        //hide loader
        this.is_data_loading = false;
      }
    });
  }


  on_pdf_render(event){
     this.show_pdf_loader = false;
      this.change_bbox();
  }

  get_prompt_response(){

    if(this.chat_form.invalid && !this.current_session_id)
      return;


    //insert the prompt as question
    let prompt:any =  this.chat_form.value.prompt;
    this.create_new_msg(prompt)

    //reset the form remove the value from the
    //input field
    this.chat_form.reset()

    //scroll chat to bottom
    this.scroll_chat_to_bottom()

    //show loader
    this.is_response_being_generated = true;
    let prompt_request = {
      'session_id':this.current_session_id,
      prompt
    }
    this.chatService.get_prompt_response(prompt_request).subscribe({
      next:(data:any)=>{
        this.messages[this.messages.length - 1]['answer'] += data.result;
        //merge all evidences
        let evidenceInstances = []

        for(let i = 0; i < data.source_documents.length; i++ ){
          let sourceDoc = data.source_documents[i]
          let srcInstance  = (<any>sourceDoc).metadata.evidences.instances;
          evidenceInstances = evidenceInstances.concat(srcInstance)

        }

        this.messages[this.messages.length - 1]['instances'] = evidenceInstances
        this.init_annotation(evidenceInstances[0])

      },

      error:(err)=>{
        //hide loader
        this.is_response_being_generated = false;
        showErrors(err, this.toastService)
      },
      complete:()=>{
        //hide loader
        this.is_response_being_generated = false;
      }
    });
  }


  //if first question asked initialize
  //the document and annotation to first instance
  init_annotation(instance){
    if(this.messages.length == 1){
        this.current_instance = instance;
        this.on_instance_change(instance)
        instance['checked'] = true
    }
  }


  create_new_msg(prompt:any){
    let new_msg =  {
      question:prompt,
      answer:""

    }
    this.messages.push(new_msg)
  }


  scroll_chat_to_bottom(){
    setTimeout(()=>{
      let chat_box_height = this.chat_container.nativeElement.scrollHeight ;
      this.chat_container.nativeElement.scroll({
        top: chat_box_height,
        left: 0,
        behavior: 'smooth'
      });
    }, 100)
  }


  on_mode_change(){
    this.refresh_chat();
    this.create_session();
  }


  refresh_chat(){
    //remove previous message message
    this.messages = [];
  }


  create_session(){
    //start the loader
    this.is_session_created = false;
    this.chatService.create_session(this.topic_id, this.session_mode).subscribe({
      next:(data:any)=>{
        this.current_session_id = data.session_id;
      },
      error:(err)=>{
        //hide loader
        showErrors(err, this.toastService)
      },
      complete:()=>{
        //hide loader
        this.is_session_created = true;
      }
    });
  }

  change_file(){
    this.pdfSrc = null
    this.fileService.read_file(this.current_instance.file_id, this.current_instance.page_no).subscribe(
      {
        next:async (data:any)=>{
            this.pdfSrc = await blobToSrc(data);
        },
        error:(err)=>{
          //hide loader
          showErrors(err, this.toastService)
        },
        complete:()=>{
        }
      }
    )
  }


  is_page_and_file_same(instance){
    return this.currentPage == instance.page && this.current_instance.file_id == instance.file_id;
  }


  on_instance_change(instance){
    this.show_pdf_loader = true;
    this.activeBbox = null;
    let is_all_same = this.is_page_and_file_same(instance);
    this.current_instance = instance;
    if(!is_all_same){
      this.change_file()
    }
    else{
      this.change_bbox()
    }

  }


  change_bbox(){
    this.activeBbox = this.current_instance.bbox;
  }

  reset_context(){
    //show the loader
    this.is_reseting_context = true
    //remove active bbox
    this.activeBbox = null;

    this.chatService.reset_context(this.current_session_id).subscribe({
        error:(err)=>{
          //hide loader
          this.is_reseting_context = false
          showErrors(err, this.toastService)
        },
        complete:()=>{
          //hide loader
          this.is_reseting_context = false;
          //reset chat messages
          this.refresh_chat();
        }
      })
  }
}
