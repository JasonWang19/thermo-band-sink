const { format, createLogger, transports } = require('winston');


const logger = createLogger({
    format: format.combine(
        // format.label({ label: '[my-label]' }),
        format.timestamp(),
        format.simple()
    ),
    transports: [
        new transports.Console()
    ]
});

module.exports = {
    logger
}