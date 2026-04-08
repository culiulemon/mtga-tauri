use parking_lot::Mutex;
use serde::Serialize;
use std::collections::VecDeque;
use std::sync::Arc;

const MAX_LOGS: usize = 2000;

#[derive(Debug, Clone, Serialize, Default)]
pub struct LogEntry {
    pub id: usize,
    pub text: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct LogPullResult {
    pub logs: Vec<LogEntry>,
    pub next_id: usize,
    pub has_more: bool,
}

#[derive(Clone)]
pub struct LogBus {
    inner: Arc<Mutex<LogBusInner>>,
}

struct LogBusInner {
    entries: VecDeque<LogEntry>,
    next_id: usize,
}

impl LogBus {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(LogBusInner {
                entries: VecDeque::new(),
                next_id: 0,
            })),
        }
    }

    pub fn push(&self, text: impl Into<String>) {
        let mut inner = self.inner.lock();
        let entry = LogEntry {
            id: inner.next_id,
            text: text.into(),
        };
        inner.next_id += 1;
        inner.entries.push_back(entry);
        while inner.entries.len() > MAX_LOGS {
            inner.entries.pop_front();
        }
    }

    pub fn pull(&self, after_id: Option<usize>, max_items: usize) -> LogPullResult {
        let inner = self.inner.lock();
        let start = match after_id {
            Some(id) => inner
                .entries
                .iter()
                .position(|e| e.id > id)
                .unwrap_or(inner.entries.len()),
            None => 0,
        };
        let end = (start + max_items).min(inner.entries.len());
        let logs: Vec<LogEntry> = inner
            .entries
            .iter()
            .skip(start)
            .take(end - start)
            .cloned()
            .collect();
        let has_more = end < inner.entries.len();
        let next_id = inner.next_id;
        LogPullResult {
            logs,
            next_id,
            has_more,
        }
    }

    pub fn clear(&self) {
        let mut inner = self.inner.lock();
        inner.entries.clear();
    }
}
