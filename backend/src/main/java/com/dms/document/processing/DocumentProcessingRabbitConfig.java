package com.dms.document.processing;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.ExchangeBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(DocumentProcessingProperties.class)
public class DocumentProcessingRabbitConfig {
    public static final String TASKS_EXCHANGE = "dms.tasks";
    public static final String DEAD_LETTER_EXCHANGE = "dms.dlx";
    public static final String RETRY_EXCHANGE = "dms.retry";
    public static final String EXTRACT_QUEUE = "dms.extract";
    public static final String INDEX_QUEUE = "dms.index";
    public static final String DLQ = "dms.dlq";
    public static final String EXTRACT_RETRY_30S_QUEUE = "dms.extract.retry.30s";
    public static final String EXTRACT_RETRY_5M_QUEUE = "dms.extract.retry.5m";
    public static final String EXTRACT_RETRY_30M_QUEUE = "dms.extract.retry.30m";
    public static final String EXTRACT_ROUTING_KEY = "extract";
    public static final String INDEX_ROUTING_KEY = "index";
    public static final String DLQ_ROUTING_KEY = "dlq";
    public static final String EXTRACT_RETRY_30S_ROUTING_KEY = "extract.retry.30s";
    public static final String EXTRACT_RETRY_5M_ROUTING_KEY = "extract.retry.5m";
    public static final String EXTRACT_RETRY_30M_ROUTING_KEY = "extract.retry.30m";

    @Bean
    DirectExchange tasksExchange() {
        return ExchangeBuilder.directExchange(TASKS_EXCHANGE).durable(true).build();
    }

    @Bean
    DirectExchange deadLetterExchange() {
        return ExchangeBuilder.directExchange(DEAD_LETTER_EXCHANGE).durable(true).build();
    }

    @Bean
    DirectExchange retryExchange() {
        return ExchangeBuilder.directExchange(RETRY_EXCHANGE).durable(true).build();
    }

    @Bean
    Queue extractQueue() {
        return QueueBuilder.durable(EXTRACT_QUEUE)
                .deadLetterExchange(DEAD_LETTER_EXCHANGE)
                .deadLetterRoutingKey(DLQ_ROUTING_KEY)
                .build();
    }

    @Bean
    Queue indexQueue() {
        return QueueBuilder.durable(INDEX_QUEUE)
                .deadLetterExchange(DEAD_LETTER_EXCHANGE)
                .deadLetterRoutingKey(DLQ_ROUTING_KEY)
                .build();
    }

    @Bean
    Queue deadLetterQueue() {
        return QueueBuilder.durable(DLQ).build();
    }

    @Bean
    Queue extractRetry30sQueue() {
        return retryQueue(EXTRACT_RETRY_30S_QUEUE, 30_000);
    }

    @Bean
    Queue extractRetry5mQueue() {
        return retryQueue(EXTRACT_RETRY_5M_QUEUE, 300_000);
    }

    @Bean
    Queue extractRetry30mQueue() {
        return retryQueue(EXTRACT_RETRY_30M_QUEUE, 1_800_000);
    }

    @Bean
    Binding extractBinding(Queue extractQueue, DirectExchange tasksExchange) {
        return BindingBuilder.bind(extractQueue).to(tasksExchange).with(EXTRACT_ROUTING_KEY);
    }

    @Bean
    Binding indexBinding(Queue indexQueue, DirectExchange tasksExchange) {
        return BindingBuilder.bind(indexQueue).to(tasksExchange).with(INDEX_ROUTING_KEY);
    }

    @Bean
    Binding deadLetterBinding(Queue deadLetterQueue, DirectExchange deadLetterExchange) {
        return BindingBuilder.bind(deadLetterQueue).to(deadLetterExchange).with(DLQ_ROUTING_KEY);
    }

    @Bean
    Binding extractRetry30sBinding(Queue extractRetry30sQueue, DirectExchange retryExchange) {
        return BindingBuilder.bind(extractRetry30sQueue).to(retryExchange).with(EXTRACT_RETRY_30S_ROUTING_KEY);
    }

    @Bean
    Binding extractRetry5mBinding(Queue extractRetry5mQueue, DirectExchange retryExchange) {
        return BindingBuilder.bind(extractRetry5mQueue).to(retryExchange).with(EXTRACT_RETRY_5M_ROUTING_KEY);
    }

    @Bean
    Binding extractRetry30mBinding(Queue extractRetry30mQueue, DirectExchange retryExchange) {
        return BindingBuilder.bind(extractRetry30mQueue).to(retryExchange).with(EXTRACT_RETRY_30M_ROUTING_KEY);
    }

    @Bean
    MessageConverter messageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory, MessageConverter messageConverter) {
        RabbitTemplate rabbitTemplate = new RabbitTemplate(connectionFactory);
        rabbitTemplate.setMessageConverter(messageConverter);
        return rabbitTemplate;
    }

    @Bean
    SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(ConnectionFactory connectionFactory, MessageConverter messageConverter) {
        SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setMessageConverter(messageConverter);
        factory.setAcknowledgeMode(org.springframework.amqp.core.AcknowledgeMode.MANUAL);
        factory.setPrefetchCount(1);
        return factory;
    }

    private Queue retryQueue(String queueName, int ttlMillis) {
        return QueueBuilder.durable(queueName)
                .ttl(ttlMillis)
                .deadLetterExchange(TASKS_EXCHANGE)
                .deadLetterRoutingKey(EXTRACT_ROUTING_KEY)
                .build();
    }
}
