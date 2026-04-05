import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { WebSocketServer, WebSocket } from 'ws';

console.log('Success: All critical modules imported correctly.');
