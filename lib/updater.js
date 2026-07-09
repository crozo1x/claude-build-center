const EVENT_STATUS_MAP = {
  'checking-for-update': 'checking',
  'update-available': 'available',
  'update-not-available': 'not-available',
  'download-progress': 'downloading',
  'update-downloaded': 'downloaded',
  error: 'error',
};

function mapUpdaterEvent(eventName) {
  return EVENT_STATUS_MAP[eventName] || null;
}

function attachUpdaterEvents(autoUpdaterImpl, onStatus) {
  Object.keys(EVENT_STATUS_MAP).forEach((eventName) => {
    autoUpdaterImpl.on(eventName, () => {
      onStatus(mapUpdaterEvent(eventName));
    });
  });
}

module.exports = { mapUpdaterEvent, attachUpdaterEvents };
