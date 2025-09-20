#!/usr/bin/env node

const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = 3005; // Different from your main API port

// Enable CORS for all routes
app.use(cors());

// Base path to your evorun
const EVORUN_PATH = '/Users/bjornpjo/Developer/apps/kromosynth-cli/cli-app/evoruns/01JDZSGV6ZZ4YEA48XMA07D8XR_evoConf_singleMap_refSingleEmb_mfcc-sans0-statistics_AE_retrainIncr50_zScoreNSynthTrain_bassSynth';
const EVORUN_ID = '01JDZSGV6ZZ4YEA48XMA07D8XR_evoConf_singleMap_refSingleEmb_mfcc-sans0-statistics_AE_retrainIncr50_zScoreNSynthTrain_bassSynth';

// Serve static files from the evorun directory
app.use('/files', express.static(EVORUN_PATH));

// List available genomes
app.get('/genomes', (req, res) => {
  try {
    const files = fs.readdirSync(EVORUN_PATH);
    const genomeFiles = files.filter(file => file.startsWith('genome_') && file.endsWith('.json.gz'));
    
    const genomes = genomeFiles.map(file => {
      // Extract genome ID from filename
      // Format: genome_<EVORUN_ID>_<GENOME_ID>.json.gz
      const match = file.match(/genome_.*?_([^.]+)\.json\.gz$/);
      const genomeId = match ? match[1] : file;
      
      return {
        genomeId,
        fileName: file,
        url: `http://localhost:${PORT}/files/${file}`,
        evoRunId: EVORUN_ID
      };
    });
    
    res.json({
      success: true,
      count: genomes.length,
      genomes: genomes.slice(0, 10) // Return first 10 for testing
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get specific genome
app.get('/genome/:genomeId', (req, res) => {
  try {
    const { genomeId } = req.params;
    const files = fs.readdirSync(EVORUN_PATH);
    const genomeFile = files.find(file => 
      file.startsWith('genome_') && 
      file.includes(genomeId) && 
      file.endsWith('.json.gz')
    );
    
    if (!genomeFile) {
      return res.status(404).json({
        success: false,
        error: 'Genome not found'
      });
    }
    
    res.json({
      success: true,
      genomeId,
      fileName: genomeFile,
      url: `http://localhost:${PORT}/files/${genomeFile}`,
      evoRunId: EVORUN_ID
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    port: PORT,
    evoRunPath: EVORUN_PATH,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`Genome file server running on http://localhost:${PORT}`);
  console.log(`Serving files from: ${EVORUN_PATH}`);
  console.log(`Available endpoints:`);
  console.log(`  GET /health - Health check`);
  console.log(`  GET /genomes - List available genomes`);
  console.log(`  GET /genome/:genomeId - Get specific genome info`);
  console.log(`  GET /files/:filename - Direct file access`);
});
