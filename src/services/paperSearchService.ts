import { supabase, isSupabaseOffline, markSupabaseUnavailable, withTimeout } from '@/lib/supabase';

export interface SearchResult {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  abstract: string;
  source: string;
  url?: string;
  pdf_url?: string;
  citations?: number;
  arxiv_id?: string;
  doi?: string;
  code_url?: string;
  has_code?: boolean;
}

export interface CodeRepository {
  url: string;
  framework?: string;
  stars?: number;
  description?: string;
}

// Try to use edge function first, fallback to direct API calls
async function tryEdgeFunction(body: any): Promise<any> {
  // Skip if Supabase is known to be offline
  if (isSupabaseOffline()) {
    return null;
  }

  try {
    const { data, error } = await withTimeout(
      supabase.functions.invoke('summarize-paper', { body }),
      20000 // 20s — arXiv and PWC can be slow from edge functions
    );
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.warn('Edge function unavailable, using fallback:', error);
    return null;
  }
}

function interleaveResults(arrays: SearchResult[][]): SearchResult[] {
  const out: SearchResult[] = [];
  const maxLen = Math.max(...arrays.map(a => a.length), 0);
  for (let i = 0; i < maxLen; i++) {
    for (const arr of arrays) {
      if (i < arr.length) out.push(arr[i]);
    }
  }
  return out;
}

function dedup(papers: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return papers.filter(p => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

// Main search function that uses edge function or fallback
export async function searchPapers(
  query: string,
  source: 'all' | 'semantic-scholar' | 'arxiv' | 'papers-with-code' = 'all',
  limit: number = 10,
  offset: number = 0,
): Promise<SearchResult[]> {
  if (source === 'all') {
    let ssResults: SearchResult[] = [];
    let axResults: SearchResult[] = [];
    let pwcResults: SearchResult[] = [];

    if (!isSupabaseOffline()) {
      // Single call — edge function runs all 3 APIs in parallel internally
      const result = await tryEdgeFunction({ action: 'search', query, source: 'all', limit, offset });
      if (result?.results?.length > 0) {
        const papers = result.results as SearchResult[];
        ssResults  = papers.filter(p => p.source === 'Semantic Scholar');
        axResults  = papers.filter(p => p.source === 'arXiv');
        pwcResults = papers.filter(p => p.source === 'Papers With Code');
      }
    }

    // Only supplement sources that returned nothing from the live API
    if (ssResults.length  === 0) ssResults  = getSamplePapers(query, 'semantic-scholar',   limit, offset);
    if (axResults.length  === 0) axResults  = getSamplePapers(query, 'arxiv',              limit, offset);
    if (pwcResults.length === 0) pwcResults = getSamplePapers(query, 'papers-with-code',   limit, offset);

    return dedup(interleaveResults([ssResults, axResults, pwcResults])).slice(0, limit);
  }

  // Single-source path
  if (!isSupabaseOffline()) {
    const edgeResult = await tryEdgeFunction({ action: 'search', query, source, limit, offset });
    if (edgeResult?.results?.length > 0) return edgeResult.results;
  }

  return getSamplePapers(query, source, limit, offset);
}

// Get code repositories for a paper
export async function getCodeRepositories(paperId: string, arxivId?: string, title?: string): Promise<CodeRepository[]> {
  if (isSupabaseOffline()) return [];

  const edgeResult = await tryEdgeFunction({ action: 'repos', arxivId, title, paperId });
  // Only return repos that PWC confirmed belong to this exact paper
  return edgeResult?.repositories ?? [];
}

// Get paper recommendations based on a paper's content
export async function getRecommendations(paper: { title: string; abstract?: string; tags?: string[] }): Promise<SearchResult[]> {
  // Extract key terms from title
  const searchTerms = paper.title.split(' ')
    .filter(word => word.length > 4)
    .slice(0, 5)
    .join(' ');
  
  return searchPapers(searchTerms, 'all', 10);
}

// AI-powered recommendations using Groq
export async function getAIRecommendations(paper: { title: string; abstract?: string; tags?: string[] }): Promise<string> {
  // Skip if Supabase is offline
  if (isSupabaseOffline()) {
    return getDefaultRecommendations(paper);
  }

  try {
    const { data, error } = await withTimeout(
      supabase.functions.invoke('summarize-paper', {
        body: {
          text: paper,
          action: 'recommend'
        }
      }),
      8000
    );
    
    if (error) throw error;
    return data.summary;
  } catch (error) {
    console.warn('AI recommendation service unavailable:', error);
    return getDefaultRecommendations(paper);
  }
}

// Default recommendations when AI is unavailable
function getDefaultRecommendations(paper: { title: string; abstract?: string; tags?: string[] }): string {
  const tags = paper.tags || [];
  const title = paper.title.toLowerCase();
  
  let recommendations = `Based on "${paper.title}", here are suggested research directions:\n\n`;
  
  if (title.includes('neural') || title.includes('deep learning') || tags.includes('Deep Learning')) {
    recommendations += `1. **Transformer Architectures** - Explore attention mechanisms and their applications\n`;
    recommendations += `2. **Neural Architecture Search** - Automated design of neural networks\n`;
    recommendations += `3. **Efficient Deep Learning** - Model compression and optimization techniques\n`;
  } else if (title.includes('nlp') || title.includes('language') || tags.includes('NLP')) {
    recommendations += `1. **Large Language Models** - GPT, BERT, and their variants\n`;
    recommendations += `2. **Multilingual NLP** - Cross-lingual transfer learning\n`;
    recommendations += `3. **Dialogue Systems** - Conversational AI and chatbots\n`;
  } else if (title.includes('computer vision') || title.includes('image') || tags.includes('Computer Vision')) {
    recommendations += `1. **Vision Transformers** - ViT and its applications\n`;
    recommendations += `2. **Object Detection** - YOLO, Faster R-CNN advances\n`;
    recommendations += `3. **Image Generation** - Diffusion models and GANs\n`;
  } else {
    recommendations += `1. **Related Survey Papers** - Comprehensive overviews of the field\n`;
    recommendations += `2. **Recent Conference Papers** - ICML, NeurIPS, CVPR, ACL proceedings\n`;
    recommendations += `3. **Benchmark Datasets** - Standard evaluation datasets for comparison\n`;
  }
  
  recommendations += `4. **Implementation Studies** - Papers with available code repositories\n`;
  recommendations += `5. **Application Papers** - Real-world applications of the methodology\n`;
  
  return recommendations;
}

// Topic keyword → paper IDs mapping for relevant fallback results
const TOPIC_MAP: Record<string, string[]> = {
  'machine learning':    ['s1','s2','s11','s10','s12'],
  'deep learning':       ['s1','s3','s6','s10','s2'],
  'nlp':                 ['s2','s4','s8','s13','s1'],
  'natural language':    ['s2','s4','s8','s13','s1'],
  'computer vision':     ['s3','s6','s9','s14','s7'],
  'algorithms':          ['s15','s11','s16','s17','s12'],
  'data structures':     ['s15','s16','s17','s18','s11'],
  'distributed systems': ['s19','s20','s21','s18','s17'],
  'cybersecurity':       ['s22','s23','s24','s25','s17'],
  'security':            ['s22','s23','s24','s25'],
  'databases':           ['s26','s27','s28','s18','s15'],
  'cloud computing':     ['s19','s20','s29','s21','s27'],
  'blockchain':          ['s30','s31','s22','s17'],
  'quantum computing':   ['s32','s33','s34','s15'],
};

// All sample papers indexed by ID
// Sources are distributed across Semantic Scholar, arXiv, and Papers With Code
const SAMPLE_PAPER_DB: Record<string, SearchResult> = {
  // ── Machine Learning / Deep Learning ──────────────────────────────────────
  s1: { id:'s1', title:'Attention Is All You Need', authors:['Ashish Vaswani','Noam Shazeer','Niki Parmar'], year:2017, abstract:'We propose a new network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely. Experiments on two machine translation tasks show these models to be superior in quality while being more parallelizable.', source:'Semantic Scholar', url:'https://arxiv.org/abs/1706.03762', pdf_url:'https://arxiv.org/pdf/1706.03762.pdf', citations:90000, arxiv_id:'1706.03762', has_code:true, code_url:'https://github.com/tensorflow/tensor2tensor' },
  s2: { id:'s2', title:'BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding', authors:['Jacob Devlin','Ming-Wei Chang','Kenton Lee'], year:2018, abstract:'We introduce BERT, designed to pre-train deep bidirectional representations from unlabeled text by jointly conditioning on both left and right context in all layers. Fine-tuned with one additional output layer, BERT achieves state-of-the-art results on eleven NLP tasks.', source:'arXiv', url:'https://arxiv.org/abs/1810.04805', pdf_url:'https://arxiv.org/pdf/1810.04805.pdf', citations:75000, arxiv_id:'1810.04805', has_code:true, code_url:'https://github.com/google-research/bert' },
  s3: { id:'s3', title:'Deep Residual Learning for Image Recognition', authors:['Kaiming He','Xiangyu Zhang','Shaoqing Ren'], year:2016, abstract:'We present a residual learning framework to ease the training of networks that are substantially deeper than those used previously. Our 152-layer residual nets are the deepest networks ever deployed on ImageNet. The ensemble of these residual nets achieves 3.57% error on the ImageNet test set.', source:'Papers With Code', url:'https://arxiv.org/abs/1512.03385', pdf_url:'https://arxiv.org/pdf/1512.03385.pdf', citations:150000, arxiv_id:'1512.03385', has_code:true, code_url:'https://github.com/KaimingHe/deep-residual-networks' },
  s4: { id:'s4', title:'GPT-4 Technical Report', authors:['OpenAI'], year:2023, abstract:'We report the development of GPT-4, a large-scale multimodal model which can accept image and text inputs and produce text outputs. GPT-4 exhibits human-level performance on various professional and academic benchmarks including passing a simulated bar exam with scores in the top 10%.', source:'arXiv', url:'https://arxiv.org/abs/2303.08774', pdf_url:'https://arxiv.org/pdf/2303.08774.pdf', citations:5000, arxiv_id:'2303.08774', has_code:false },
  s6: { id:'s6', title:'ImageNet Classification with Deep Convolutional Neural Networks', authors:['Alex Krizhevsky','Ilya Sutskever','Geoffrey E. Hinton'], year:2012, abstract:'We trained a large deep convolutional neural network to classify 1.2 million high-resolution images into 1000 classes. The network, AlexNet, achieved top-1 and top-5 error rates of 37.5% and 17.0%, considerably better than the previous state-of-the-art.', source:'Semantic Scholar', url:'https://papers.nips.cc/paper/4824', citations:120000, has_code:false },
  s7: { id:'s7', title:'Denoising Diffusion Probabilistic Models', authors:['Jonathan Ho','Ajay Jain','Pieter Abbeel'], year:2020, abstract:'We present high quality image synthesis results using diffusion probabilistic models. Our best results are obtained by training on a weighted variational bound designed according to a novel connection between diffusion probabilistic models and denoising score matching.', source:'Papers With Code', url:'https://arxiv.org/abs/2006.11239', pdf_url:'https://arxiv.org/pdf/2006.11239.pdf', citations:8000, arxiv_id:'2006.11239', has_code:true, code_url:'https://github.com/hojonathanho/diffusion' },
  s8: { id:'s8', title:'Language Models are Few-Shot Learners (GPT-3)', authors:['Tom B. Brown','Benjamin Mann','Nick Ryder'], year:2020, abstract:'We show that scaling up language models greatly improves task-agnostic few-shot performance, sometimes reaching competitiveness with prior state-of-the-art fine-tuning approaches. GPT-3 has 175 billion parameters and achieves strong performance on many NLP datasets.', source:'arXiv', url:'https://arxiv.org/abs/2005.14165', pdf_url:'https://arxiv.org/pdf/2005.14165.pdf', citations:25000, arxiv_id:'2005.14165', has_code:false },
  s9: { id:'s9', title:'You Only Look Once: Unified, Real-Time Object Detection', authors:['Joseph Redmon','Santosh Divvala','Ross Girshick'], year:2016, abstract:'We present YOLO, a new approach to object detection framed as a regression problem to spatially separated bounding boxes and associated class probabilities. A single neural network predicts bounding boxes and class probabilities directly from full images in one evaluation.', source:'Papers With Code', url:'https://arxiv.org/abs/1506.02640', pdf_url:'https://arxiv.org/pdf/1506.02640.pdf', citations:35000, arxiv_id:'1506.02640', has_code:true, code_url:'https://github.com/pjreddie/darknet' },
  s10:{ id:'s10', title:'Dropout: A Simple Way to Prevent Neural Networks from Overfitting', authors:['Nitish Srivastava','Geoffrey Hinton','Alex Krizhevsky'], year:2014, abstract:'We propose dropout, a technique for addressing overfitting in deep neural networks. The key idea is to randomly drop units (along with their connections) from the neural network during training. This prevents units from co-adapting too much.', source:'Semantic Scholar', url:'https://jmlr.org/papers/v15/srivastava14a.html', citations:45000, has_code:false },
  s11:{ id:'s11', title:'Adam: A Method for Stochastic Optimization', authors:['Diederik P. Kingma','Jimmy Ba'], year:2015, abstract:'We introduce Adam, an algorithm for first-order gradient-based optimization of stochastic objective functions. The method computes individual adaptive learning rates for different parameters from estimates of first and second moments of the gradients.', source:'arXiv', url:'https://arxiv.org/abs/1412.6980', pdf_url:'https://arxiv.org/pdf/1412.6980.pdf', citations:180000, arxiv_id:'1412.6980', has_code:false },
  s12:{ id:'s12', title:'Graph Neural Networks: A Review of Methods and Applications', authors:['Jie Zhou','Ganqu Cui','Shengding Hu'], year:2020, abstract:'We provide a comprehensive review of graph neural networks (GNNs) in data mining and machine learning fields. We propose a new taxonomy to divide the state-of-the-art GNN models and discuss their applications across various domains.', source:'Papers With Code', url:'https://arxiv.org/abs/1812.08434', pdf_url:'https://arxiv.org/pdf/1812.08434.pdf', citations:8000, arxiv_id:'1812.08434', has_code:false },
  s13:{ id:'s13', title:'Sequence to Sequence Learning with Neural Networks', authors:['Ilya Sutskever','Oriol Vinyals','Quoc V. Le'], year:2014, abstract:'We present a general end-to-end approach to sequence learning that makes minimal assumptions on the sequence structure. We used a multilayered LSTM to map the input sequence to a vector of a fixed dimensionality, and then another deep LSTM to decode the target sequence from the vector.', source:'Semantic Scholar', url:'https://arxiv.org/abs/1409.3215', pdf_url:'https://arxiv.org/pdf/1409.3215.pdf', citations:20000, arxiv_id:'1409.3215', has_code:true, code_url:'https://github.com/google/seq2seq' },
  s14:{ id:'s14', title:'Faster R-CNN: Towards Real-Time Object Detection with Region Proposal Networks', authors:['Shaoqing Ren','Kaiming He','Ross Girshick'], year:2015, abstract:'We introduce a Region Proposal Network (RPN) that shares full-image convolutional features with the detection network, enabling nearly cost-free region proposals. The RPN is a fully convolutional network that simultaneously predicts object bounds and objectness scores.', source:'arXiv', url:'https://arxiv.org/abs/1506.01497', pdf_url:'https://arxiv.org/pdf/1506.01497.pdf', citations:40000, arxiv_id:'1506.01497', has_code:true, code_url:'https://github.com/rbgirshick/py-faster-rcnn' },

  // ── Algorithms / Data Structures ──────────────────────────────────────────
  s15:{ id:'s15', title:'Introduction to Algorithms (Survey of Complexity Classes)', authors:['Thomas H. Cormen','Charles E. Leiserson','Ronald L. Rivest'], year:2022, abstract:'A comprehensive survey of algorithm design and analysis techniques including divide-and-conquer, dynamic programming, greedy algorithms, graph algorithms, and NP-completeness theory. Covers amortized analysis and advanced data structures.', source:'Semantic Scholar', url:'https://arxiv.org/abs/2209.09900', citations:5000, has_code:false },
  s16:{ id:'s16', title:'Cache-Oblivious Algorithms and Data Structures', authors:['Erik D. Demaine'], year:2002, abstract:'We survey cache-oblivious algorithms and data structures, which are designed to be efficient on machines with multiple levels of memory without knowledge of the memory hierarchy parameters. Key structures include the cache-oblivious B-tree and van Emde Boas layout.', source:'Papers With Code', url:'https://erikdemaine.org/papers/BRICS2002/', citations:1200, has_code:false },
  s17:{ id:'s17', title:'MapReduce: Simplified Data Processing on Large Clusters', authors:['Jeffrey Dean','Sanjay Ghemawat'], year:2004, abstract:'MapReduce is a programming model and associated implementation for processing and generating large data sets. Users specify a map function that processes a key/value pair to generate intermediate key/value pairs, and a reduce function that merges all intermediate values.', source:'Semantic Scholar', url:'https://research.google/pubs/pub62/', citations:22000, has_code:false },
  s18:{ id:'s18', title:'Dynamo: Amazon\'s Highly Available Key-Value Store', authors:['Giuseppe DeCandia','Deniz Hastorun','Madan Jampani'], year:2007, abstract:'This paper presents the design and implementation of Dynamo, a highly available key-value storage system used at Amazon. Dynamo uses a synthesis of well known techniques — consistent hashing, vector clocks, gossip-based failure detection — to achieve high availability.', source:'arXiv', url:'https://dl.acm.org/doi/10.1145/1294261.1294281', citations:5500, has_code:false },

  // ── Distributed Systems ────────────────────────────────────────────────────
  s19:{ id:'s19', title:'The Google File System', authors:['Sanjay Ghemawat','Howard Gobioff','Shun-Tak Leung'], year:2003, abstract:'We present the design and implementation of the Google File System, a scalable distributed file system for large distributed data-intensive applications. It provides fault tolerance while running on inexpensive commodity hardware, and delivers high aggregate performance to large numbers of clients.', source:'Semantic Scholar', url:'https://research.google/pubs/pub51/', citations:11000, has_code:false },
  s20:{ id:'s20', title:'Raft: In Search of an Understandable Consensus Algorithm', authors:['Diego Ongaro','John Ousterhout'], year:2014, abstract:'Raft is a consensus algorithm designed as an alternative to Paxos. Raft separates the key elements of consensus (leader election, log replication, safety) and enforces a stronger degree of coherency to reduce the number of states that must be considered.', source:'Papers With Code', url:'https://raft.github.io/raft.pdf', citations:4000, has_code:true, code_url:'https://github.com/ongardie/dissertation' },
  s21:{ id:'s21', title:'Spanner: Google\'s Globally Distributed Database', authors:['James C. Corbett','Jeffrey Dean','Michael Epstein'], year:2012, abstract:'Spanner is Google\'s scalable, multi-version, globally-distributed, and synchronously-replicated database. It provides externally-consistent distributed transactions. It uses TrueTime to expose clock uncertainty and design around it.', source:'arXiv', url:'https://research.google/pubs/pub39966/', citations:3000, has_code:false },
  s29:{ id:'s29', title:'Above the Clouds: A Berkeley View of Cloud Computing', authors:['Michael Armbrust','Armando Fox','Rean Griffith'], year:2010, abstract:'Cloud Computing refers to the applications delivered as services over the Internet and the hardware and systems software in the datacenters that provide those services. This paper characterizes cloud computing, the obstacles and opportunities it faces.', source:'Semantic Scholar', url:'https://www2.eecs.berkeley.edu/Pubs/TechRpts/2009/EECS-2009-28.pdf', citations:9000, has_code:false },

  // ── Cybersecurity ──────────────────────────────────────────────────────────
  s22:{ id:'s22', title:'SoK: Eternal War in Memory', authors:['László Szekeres','Mathias Payer','Tao Wei','Dawn Song'], year:2013, abstract:'We systematize the knowledge on memory corruption attacks and defenses, and discuss the arms race between attackers and defenders. We provide a framework for comparing and analyzing different defense mechanisms against memory corruption attacks.', source:'Papers With Code', url:'https://ieeexplore.ieee.org/document/6547101', citations:1500, has_code:false },
  s23:{ id:'s23', title:'Deep Learning for Cyber Security Intrusion Detection', authors:['Rahul Yumlembam','Bhogeswar Borah','Moirangthem Marjit Singh'], year:2023, abstract:'We survey deep learning techniques applied to cybersecurity intrusion detection. We examine convolutional, recurrent, and transformer-based architectures for detecting network intrusions, malware, and anomalous behavior in real-time systems.', source:'arXiv', url:'https://arxiv.org/abs/2209.03853', citations:300, has_code:false },
  s24:{ id:'s24', title:'HTTPS is the New HTTP: How TLS 1.3 Improves Security', authors:['Eric Rescorla'], year:2018, abstract:'TLS 1.3 is a major revision to the TLS protocol providing improved security and performance. This paper describes the design decisions behind TLS 1.3, including the removal of obsolete cryptographic algorithms and the introduction of a 1-RTT and 0-RTT handshake.', source:'Semantic Scholar', url:'https://tools.ietf.org/html/rfc8446', citations:800, has_code:false },
  s25:{ id:'s25', title:'Spectre Attacks: Exploiting Speculative Execution', authors:['Paul Kocher','Jann Horn','Anders Fogh','Daniel Genkin'], year:2019, abstract:'Modern processors use branch prediction and speculative execution to maximize performance. We discover that these processor optimizations can be exploited to allow malicious programs to read memory from other programs, breaking fundamental security assumptions.', source:'Papers With Code', url:'https://spectreattack.com/spectre.pdf', citations:3500, has_code:false },

  // ── Databases ──────────────────────────────────────────────────────────────
  s26:{ id:'s26', title:'Architecture of a Database System', authors:['Joseph M. Hellerstein','Michael Stonebraker','James Hamilton'], year:2007, abstract:'This paper presents an architectural discussion of DBMS design principles, including process models, parallel architecture, storage management, query processor, and transaction system. It discusses the key design decisions for relational database systems.', source:'arXiv', url:'https://dsf.berkeley.edu/papers/fntdb07-architecture.pdf', citations:2000, has_code:false },
  s27:{ id:'s27', title:'A Relational Model of Data for Large Shared Data Banks', authors:['Edgar F. Codd'], year:1970, abstract:'Future users of large data banks must be protected from having to know how the data is organized in the machine. This paper presents a relational model which allows the data to be described by its natural structure only — the relational model for database systems.', source:'Semantic Scholar', url:'https://dl.acm.org/doi/10.1145/362384.362685', citations:15000, has_code:false },
  s28:{ id:'s28', title:'Bigtable: A Distributed Storage System for Structured Data', authors:['Fay Chang','Jeffrey Dean','Sanjay Ghemawat'], year:2006, abstract:'Bigtable is a distributed storage system for managing structured data at Google. It is designed to scale to a very large size: petabytes of data across thousands of commodity servers. It has been used in over sixty Google products and projects.', source:'Papers With Code', url:'https://research.google/pubs/pub27898/', citations:6000, has_code:false },

  // ── Blockchain ─────────────────────────────────────────────────────────────
  s30:{ id:'s30', title:'Bitcoin: A Peer-to-Peer Electronic Cash System', authors:['Satoshi Nakamoto'], year:2008, abstract:'A purely peer-to-peer version of electronic cash would allow online payments to be sent directly from one party to another without going through a financial institution. We propose a solution to the double-spending problem using a peer-to-peer network.', source:'Semantic Scholar', url:'https://bitcoin.org/bitcoin.pdf', citations:15000, has_code:true, code_url:'https://github.com/bitcoin/bitcoin' },
  s31:{ id:'s31', title:'Ethereum: A Next-Generation Smart Contract and Decentralized Application Platform', authors:['Vitalik Buterin'], year:2014, abstract:'Ethereum is a blockchain with a built-in Turing-complete programming language, allowing anyone to write smart contracts and decentralized applications. Ethereum provides a platform for building decentralized autonomous organizations and other complex applications.', source:'arXiv', url:'https://ethereum.org/en/whitepaper/', citations:8000, has_code:true, code_url:'https://github.com/ethereum/go-ethereum' },

  // ── Quantum Computing ──────────────────────────────────────────────────────
  s32:{ id:'s32', title:'Quantum Supremacy Using a Programmable Superconducting Processor', authors:['Frank Arute','Kunal Arya','Ryan Babbush'], year:2019, abstract:'The promise of quantum computers is that certain computational tasks might be executed exponentially faster on a quantum processor than on a classical processor. We report the use of a processor with programmable superconducting qubits to create quantum states on 53 qubits.', source:'Papers With Code', url:'https://www.nature.com/articles/s41586-019-1666-5', citations:3000, has_code:false },
  s33:{ id:'s33', title:'Variational Quantum Eigensolver: A New Algorithm for Quantum Chemistry', authors:['Alberto Peruzzo','Jarrod McClean','Peter Shadbolt'], year:2014, abstract:'The variational quantum eigensolver is a hybrid classical-quantum algorithm for simulating quantum systems. It uses a quantum computer to efficiently evaluate expectation values while employing classical optimization algorithms to find the ground state energy.', source:'arXiv', url:'https://www.nature.com/articles/ncomms5213', citations:2500, has_code:true, code_url:'https://github.com/quantumlib/OpenFermion' },
  s34:{ id:'s34', title:'Quantum Machine Learning', authors:['Jacob Biamonte','Peter Wittek','Nicola Pancotti','Patrick Rebentrost'], year:2017, abstract:'Fuelled by increasing computer power and algorithmic advances, machine learning techniques have become powerful tools for finding patterns in data. Quantum computers offer the potential to speed up machine learning algorithms exponentially through quantum parallelism and amplitude amplification.', source:'Semantic Scholar', url:'https://arxiv.org/abs/1611.09347', pdf_url:'https://arxiv.org/pdf/1611.09347.pdf', citations:2000, arxiv_id:'1611.09397', has_code:false },
};

const SOURCE_NAME: Record<string, string> = {
  'semantic-scholar': 'Semantic Scholar',
  'arxiv': 'arXiv',
  'papers-with-code': 'Papers With Code',
};

// Sample papers for fallback when APIs are unavailable
function getSamplePapers(
  query: string,
  source: 'all' | 'semantic-scholar' | 'arxiv' | 'papers-with-code' = 'all',
  limit: number = 10,
  offset: number = 0,
): SearchResult[] {
  const q = query.toLowerCase().trim();
  const sourceFilter = source !== 'all' ? SOURCE_NAME[source] : null;

  const filterBySource = (papers: SearchResult[]) =>
    sourceFilter ? papers.filter(p => p.source === sourceFilter) : papers;

  const all = Object.values(SAMPLE_PAPER_DB);

  let pool: SearchResult[];

  if (!q || q.length < 2) {
    pool = filterBySource(all);
  } else {
    // 1. Try topic map first (exact or partial key match)
    let matched = false;
    for (const [topic, ids] of Object.entries(TOPIC_MAP)) {
      if (q.includes(topic) || topic.includes(q)) {
        pool = filterBySource(ids.map(id => SAMPLE_PAPER_DB[id]).filter(Boolean));
        matched = true;
        break;
      }
    }

    if (!matched) {
      // 2. Text search across all papers
      const textMatches = filterBySource(all).filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.abstract.toLowerCase().includes(q) ||
        p.authors.some(a => a.toLowerCase().includes(q))
      );

      // 3. If nothing matched, return a small relevant default set (no padding with unrelated papers)
      pool = textMatches.length > 0 ? textMatches : filterBySource([
        SAMPLE_PAPER_DB.s1, SAMPLE_PAPER_DB.s2, SAMPLE_PAPER_DB.s3,
      ]).filter(Boolean);
    }
  }

  return pool.slice(offset, offset + limit);
}

// Sample repositories for fallback
function getSampleRepositories(title: string): CodeRepository[] {
  const t = title.toLowerCase();
  
  if (t.includes('transformer') || t.includes('attention')) {
    return [
      { url: 'https://github.com/tensorflow/tensor2tensor', framework: 'TensorFlow', stars: 14000, description: 'Library of deep learning models and datasets' },
      { url: 'https://github.com/huggingface/transformers', framework: 'PyTorch', stars: 120000, description: 'State-of-the-art transformers for NLP' }
    ];
  }
  
  if (t.includes('bert') || t.includes('language')) {
    return [
      { url: 'https://github.com/google-research/bert', framework: 'TensorFlow', stars: 37000, description: 'TensorFlow code and pre-trained models for BERT' },
      { url: 'https://github.com/huggingface/transformers', framework: 'PyTorch', stars: 120000, description: 'State-of-the-art transformers' }
    ];
  }
  
  if (t.includes('resnet') || t.includes('image') || t.includes('cnn')) {
    return [
      { url: 'https://github.com/pytorch/vision', framework: 'PyTorch', stars: 15000, description: 'Datasets, transforms, and models for computer vision' },
      { url: 'https://github.com/keras-team/keras-applications', framework: 'Keras', stars: 2000, description: 'Reference implementations of popular deep learning models' }
    ];
  }
  
  if (t.includes('gan') || t.includes('generative')) {
    return [
      { url: 'https://github.com/NVlabs/stylegan3', framework: 'PyTorch', stars: 6000, description: 'Official PyTorch implementation of StyleGAN3' },
      { url: 'https://github.com/eriklindernoren/PyTorch-GAN', framework: 'PyTorch', stars: 15000, description: 'PyTorch implementations of GANs' }
    ];
  }
  
  if (t.includes('diffusion')) {
    return [
      { url: 'https://github.com/hojonathanho/diffusion', framework: 'TensorFlow', stars: 2000, description: 'Denoising Diffusion Probabilistic Models' },
      { url: 'https://github.com/CompVis/stable-diffusion', framework: 'PyTorch', stars: 65000, description: 'Stable Diffusion' }
    ];
  }
  
  if (t.includes('yolo') || t.includes('object detection')) {
    return [
      { url: 'https://github.com/ultralytics/yolov5', framework: 'PyTorch', stars: 45000, description: 'YOLOv5 object detection' },
      { url: 'https://github.com/pjreddie/darknet', framework: 'C', stars: 25000, description: 'Open Source Neural Networks in C' }
    ];
  }

  if (t.includes('graph') || t.includes('gnn')) {
    return [
      { url: 'https://github.com/pyg-team/pytorch_geometric', framework: 'PyTorch', stars: 20000, description: 'Graph Neural Network Library for PyTorch' },
      { url: 'https://github.com/dmlc/dgl', framework: 'PyTorch/TF', stars: 13000, description: 'Deep Graph Library' }
    ];
  }

  if (t.includes('dropout') || t.includes('regularization')) {
    return [
      { url: 'https://github.com/pytorch/pytorch', framework: 'PyTorch', stars: 78000, description: 'Tensors and Dynamic neural networks with strong GPU acceleration' }
    ];
  }

  if (t.includes('adam') || t.includes('optimization') || t.includes('optimizer')) {
    return [
      { url: 'https://github.com/pytorch/pytorch', framework: 'PyTorch', stars: 78000, description: 'Tensors and Dynamic neural networks with strong GPU acceleration' }
    ];
  }

  if (t.includes('stance') || t.includes('sentiment') || t.includes('classification')) {
    return [
      { url: 'https://github.com/huggingface/transformers', framework: 'PyTorch', stars: 120000, description: 'State-of-the-art NLP transformers' },
      { url: 'https://github.com/facebookresearch/fairseq', framework: 'PyTorch', stars: 29000, description: 'Facebook AI Research Sequence-to-Sequence Toolkit' }
    ];
  }
  
  // Default repositories
  return [
    { url: 'https://github.com/paperswithcode/paperswithcode-data', framework: 'Various', stars: 1000, description: 'Papers With Code dataset' }
  ];
}
